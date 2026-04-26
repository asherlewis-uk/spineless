// Step 2 — Qwen Coder.
//
// Receives an APPROVED StructuralPlan and produces a fully typed
// SpineMutationProposal. The model is treated as untrusted: every
// contract-critical field is re-stamped or re-validated locally.
//
// Specifically:
//   • `allowedIn` is re-stamped from MUTATION_SCOPE_BY_TYPE per mutation type.
//   • `spineGraphVersion` is OVERWRITTEN with the orchestrator-captured value.
//     Version locking is server-authoritative.
//   • `triggeredBy` is OVERWRITTEN with the triggering card id.
//   • Every `cardId` referenced by a non-`add_card` mutation must exist in the graph.

import { z } from "zod";
import type { SpineGraph } from "../../contracts/index.js";
import {
  MUTATION_SCOPE_BY_TYPE,
  SPINE_MUTATION_TYPES,
  type SpineMutation,
  type SpineMutationProposal,
  type SpineMutationType,
} from "../../contracts/mutation.js";
import type { GapCardSpec } from "../../contracts/gap.js";
import {
  LLMSchemaError,
  LLMTimeoutError,
  LLMTransportError,
  type LLMClient,
} from "../llm/types.js";
import {
  makeAgentUnresolvableGap,
  makeAnalysisTimeoutGap,
  safeQuoteForGap,
} from "./gapFactory.js";
import type { StructuralPlan } from "./projectManagerStep.js";

// ─── Public Types ────────────────────────────────────────────────────────────

export interface CoderInput {
  plan: StructuralPlan;
  spineGraph: SpineGraph;
  /** Version captured by orchestrator at entry — non-negotiable. */
  lockedSpineGraphVersion: number;
  triggeringCardId: string;
}

export type CoderOutput =
  | { kind: "proposal"; proposal: SpineMutationProposal }
  | { kind: "gap"; gap: GapCardSpec };

export interface CoderOptions {
  client: LLMClient;
  model: string;
  timeoutMs?: number;
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const mutationSchema = z.object({
  cardId: z.string().min(1),
  mutationType: z.enum(
    SPINE_MUTATION_TYPES as readonly [
      SpineMutationType,
      ...SpineMutationType[],
    ],
  ),
  payload: z.record(z.unknown()),
  // allowedIn intentionally accepted but ignored — re-stamped locally below.
  allowedIn: z.enum(["live_only", "both"]).optional(),
});

const proposalSchema = z.object({
  triggeredBy: z.string(),
  spineGraphVersion: z.number(),
  mutations: z.array(mutationSchema).min(1),
  userDescription: z.string().min(1),
  downstreamEffects: z.array(z.string()),
});

type RawProposal = z.infer<typeof proposalSchema>;

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Coder for Spineless. You convert an approved structural plan into a single SpineMutationProposal as strict JSON.

YOU DO NOT WRITE SOURCE FILES. You produce ONE JSON object that mutates the spine graph.

ALLOWED MUTATION TYPES (exhaustive):
  update_config, update_ports, update_output_schema, add_card, remove_card,
  add_connection, remove_connection, resolve_gap, rotate_secret.

CARD TYPES (the only nine — never invent others):
  input, prompt, model, tool, memory, logic, output, eval, gap.

PORT TYPES: text, number, boolean, object, array, any. ('secret' is NOT a port type.)

OUTPUT SHAPE (strict JSON, no prose, no code fences):
{
  "triggeredBy": "<card id>",
  "spineGraphVersion": <number>,
  "mutations": [
    {
      "cardId": "<card id>",
      "mutationType": "<one of the 9>",
      "payload": { ... },          // Partial<Card> for card mutations, Partial<Connection> for connection mutations
      "allowedIn": "live_only" | "both"
    }
  ],
  "userDescription": "<plain language summary, 1–2 sentences>",
  "downstreamEffects": ["<plain language>", ...]
}

The plan's "intent" becomes "userDescription". The plan's "downstreamEffects" pass through.
Each plan operation maps to exactly one mutation. Expand "payloadSummary" into a concrete payload.`;

function buildUserPrompt(input: CoderInput): string {
  return [
    `triggeringCardId: ${input.triggeringCardId}`,
    `spineGraphVersion: ${input.lockedSpineGraphVersion}`,
    "",
    "APPROVED PLAN:",
    JSON.stringify(input.plan, null, 2),
    "",
    "CARD ID INDEX (existing cards by id → type):",
    JSON.stringify(
      Object.fromEntries(
        Object.values(input.spineGraph.cards).map((c) => [c.id, c.type]),
      ),
      null,
      2,
    ),
  ].join("\n");
}

// ─── Step Entry Point ────────────────────────────────────────────────────────

export async function runCoderStep(
  input: CoderInput,
  opts: CoderOptions,
): Promise<CoderOutput> {
  let raw: RawProposal;
  try {
    raw = await opts.client.chatJSON({
      model: opts.model,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input),
      schema: proposalSchema,
      timeoutMs: opts.timeoutMs ?? 20_000,
      maxRetries: 1,
      temperature: 0,
    });
  } catch (err) {
    if (err instanceof LLMTimeoutError) {
      return {
        kind: "gap",
        gap: makeAnalysisTimeoutGap(input.triggeringCardId),
      };
    }
    if (err instanceof LLMSchemaError) {
      return {
        kind: "gap",
        gap: makeAgentUnresolvableGap(
          input.triggeringCardId,
          "The agent generated a malformed mutation payload.",
        ),
      };
    }
    if (err instanceof LLMTransportError) {
      return {
        kind: "gap",
        gap: makeAgentUnresolvableGap(
          input.triggeringCardId,
          "The code-generation service is unavailable. Try again shortly.",
        ),
      };
    }
    return {
      kind: "gap",
      gap: makeAgentUnresolvableGap(
        input.triggeringCardId,
        "An unexpected error occurred during mutation generation.",
      ),
    };
  }

  // ── Post-LLM enforcement ────────────────────────────────────────────────

  // Validate every cardId referenced by a non-add_card mutation actually exists.
  const knownCardIds = new Set(Object.keys(input.spineGraph.cards));
  for (const m of raw.mutations) {
    if (m.mutationType !== "add_card" && !knownCardIds.has(m.cardId)) {
      return {
        kind: "gap",
        gap: makeAgentUnresolvableGap(
          input.triggeringCardId,
          `The agent referenced a card that does not exist in the spine: "${safeQuoteForGap(m.cardId)}".`,
        ),
      };
    }
  }

  // Re-stamp allowedIn from the local lookup. The model cannot lie about scope.
  const mutations: SpineMutation[] = raw.mutations.map((m) => ({
    cardId: m.cardId,
    mutationType: m.mutationType,
    // The contract types Partial<Card> | Partial<Connection> are validated
    // structurally by downstream consumers (compiler / spine store). The
    // orchestrator's job is to enforce the scope and version invariants.
    payload: m.payload as SpineMutation["payload"],
    allowedIn: MUTATION_SCOPE_BY_TYPE[m.mutationType],
  }));

  const proposal: SpineMutationProposal = {
    // Force-set: server-authoritative.
    triggeredBy: input.triggeringCardId,
    spineGraphVersion: input.lockedSpineGraphVersion,
    mutations,
    userDescription: raw.userDescription || input.plan.intent,
    downstreamEffects:
      raw.downstreamEffects.length > 0
        ? raw.downstreamEffects
        : input.plan.downstreamEffects,
  };

  return { kind: "proposal", proposal };
}
