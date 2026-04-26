// Step 1 — DeepSeek Project Manager.
//
// DeepSeek receives the spine graph (scoped to the triggering card's neighborhood),
// the user's edit, the impact analysis result, and the current SystemMode.
//
// It must output ONE of two strict JSON shapes:
//   1. An approved StructuralPlan (operations + safety assessment + precedence flag), or
//   2. A reason to abort, in which case we synthesize a GapCardSpec.
//
// Defense in depth: every contract-critical decision (sealed/live_only blocking,
// mutation-type whitelist, precedence) is RE-VALIDATED locally after the model
// responds. The model is treated as untrusted.

import { z } from "zod";
import type {
  ImpactAnalysisResult,
  SpineGraph,
  SystemMode,
} from "../../contracts/index.js";
import {
  MUTATION_SCOPE_BY_TYPE,
  SPINE_MUTATION_TYPES,
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
  makeStructuralChangeInSealedGap,
} from "./gapFactory.js";
import { redactCardForPrompt } from "./promptRedaction.js";

// ─── Public Types ────────────────────────────────────────────────────────────

export interface TriggeringEdit {
  cardId: string;
  /** Plain language description of what the user changed. */
  description: string;
  /**
   * Mutation types the edit is expected to require. Best-effort only;
   * the model produces the authoritative set. Used to short-circuit
   * obviously-blocked sealed-mode structural edits before the LLM call.
   */
  intendedMutationTypes: SpineMutationType[];
}

export interface ProjectManagerInput {
  spineGraph: SpineGraph;
  triggeringEdit: TriggeringEdit;
  impactAnalysis: ImpactAnalysisResult;
  systemMode: SystemMode;
  /** Captured by the orchestrator at entry — passed through for prompt context only. */
  spineGraphVersion: number;
}

/** Strict shape DeepSeek must return. */
export interface StructuralPlan {
  intent: string;
  downstreamEffects: string[];
  operations: StructuralOperation[];
  safetyAssessment: { safe: boolean; reason?: string | undefined };
  respectsPrecedence: boolean;
}

export interface StructuralOperation {
  mutationType: SpineMutationType;
  cardId: string;
  /** Opaque payload summary that the Coder step expands into a real Partial<Card>/Partial<Connection>. */
  payloadSummary: Record<string, unknown>;
}

export type ProjectManagerOutput =
  | { kind: "approved_plan"; plan: StructuralPlan }
  | { kind: "gap"; gap: GapCardSpec };

export interface ProjectManagerOptions {
  client: LLMClient;
  model: string;
  timeoutMs?: number;
}

// ─── Zod Schema ──────────────────────────────────────────────────────────────

const structuralOperationSchema = z.object({
  mutationType: z.enum(
    SPINE_MUTATION_TYPES as readonly [
      SpineMutationType,
      ...SpineMutationType[],
    ],
  ),
  cardId: z.string().min(1),
  payloadSummary: z.record(z.unknown()),
});

const structuralPlanSchema = z.object({
  intent: z.string().min(1),
  downstreamEffects: z.array(z.string()),
  operations: z.array(structuralOperationSchema).min(1),
  safetyAssessment: z.object({
    safe: z.boolean(),
    reason: z.string().optional(),
  }),
  respectsPrecedence: z.boolean(),
});

// ─── Prompt ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Project Manager for Spineless — a visual, scroll-based environment for building AI systems by mutating a spine graph (the canonical source of truth).

You DO NOT write code. You DO NOT mutate the graph. You produce a STRUCTURAL PLAN as strict JSON.

CONTRACT PRECEDENCE (load-bearing):
  Document 10 > Documents 08–09 > Documents 00–07.
Resolve any conflict in favor of the higher-numbered document.

ALLOWED MUTATION TYPES (exhaustive — anything else is invalid):
  update_config, update_ports, update_output_schema, add_card, remove_card,
  add_connection, remove_connection, resolve_gap, rotate_secret.

MUTATION SCOPE (allowedIn):
  both:        update_config, resolve_gap, rotate_secret
  live_only:   update_ports, update_output_schema, add_card, remove_card,
               add_connection, remove_connection

CARD TYPES (the only nine — never invent others):
  input, prompt, model, tool, memory, logic, output, eval, gap.
  Note: there is NO "parser" card in v1. Structured output is declared by the
  Prompt Card and enforced by the Model Card.

PORT TYPES: text, number, boolean, object, array, any.
  'secret' is NOT a port type. Secrets never flow through ports.

SEALED-MODE RULE (absolute):
  If systemMode is "sealed" and any required operation is live_only, you MUST
  set safetyAssessment.safe = false with reason = "live_only_in_sealed".

OUTPUT (strict JSON, no prose, no code fences):
{
  "intent": "<plain language summary, 1–2 sentences>",
  "downstreamEffects": ["<plain language>", ...],
  "operations": [
    { "mutationType": "<one of the 9>", "cardId": "<card id>", "payloadSummary": { ... } }
  ],
  "safetyAssessment": { "safe": <boolean>, "reason": "<short identifier if unsafe>" },
  "respectsPrecedence": <boolean>
}

If the change is unsafe or violates precedence, still return the plan with
safetyAssessment.safe = false — do not invent text outside this schema.`;

function buildUserPrompt(input: ProjectManagerInput): string {
  // Token economy: scope the graph to the triggering card + 1-hop neighborhood.
  const scoped = scopeGraphForPrompt(
    input.spineGraph,
    input.triggeringEdit.cardId,
  );
  return [
    `systemMode: ${input.systemMode}`,
    `spineGraphVersion: ${input.spineGraphVersion}`,
    "",
    "TRIGGERING EDIT:",
    JSON.stringify(input.triggeringEdit, null, 2),
    "",
    "IMPACT ANALYSIS:",
    JSON.stringify(input.impactAnalysis, null, 2),
    "",
    "SPINE GRAPH (triggering card + 1-hop neighborhood):",
    JSON.stringify(scoped, null, 2),
  ].join("\n");
}

function scopeGraphForPrompt(graph: SpineGraph, triggerCardId: string) {
  const include = new Set<string>([triggerCardId]);
  for (const conn of Object.values(graph.connections)) {
    if (conn.sourceCardId === triggerCardId) include.add(conn.targetCardId);
    if (conn.targetCardId === triggerCardId) include.add(conn.sourceCardId);
  }
  const cards: Record<string, unknown> = {};
  for (const id of include) {
    const card = graph.cards[id];
    if (card) cards[id] = redactCardForPrompt(card);
  }
  const connections: Record<string, unknown> = {};
  for (const [id, conn] of Object.entries(graph.connections)) {
    if (include.has(conn.sourceCardId) || include.has(conn.targetCardId)) {
      connections[id] = conn;
    }
  }
  // Doc 10 §7: don't leak the full topology beyond the scoped neighborhood.
  const executionOrder = graph.executionOrder.filter((id) => include.has(id));
  return {
    id: graph.id,
    version: graph.version,
    executionOrder,
    cards,
    connections,
  };
}

// ─── Step Entry Point ────────────────────────────────────────────────────────

export async function runProjectManagerStep(
  input: ProjectManagerInput,
  opts: ProjectManagerOptions,
): Promise<ProjectManagerOutput> {
  // Pre-LLM short-circuit: the user's stated intent is already structurally
  // forbidden in Sealed. Skip the model call entirely.
  if (input.systemMode === "sealed") {
    const blocked = input.triggeringEdit.intendedMutationTypes.find(
      (t) => MUTATION_SCOPE_BY_TYPE[t] === "live_only",
    );
    if (blocked !== undefined) {
      return {
        kind: "gap",
        gap: makeStructuralChangeInSealedGap(
          input.triggeringEdit.cardId,
          input.triggeringEdit.description,
        ),
      };
    }
  }

  let plan: StructuralPlan;
  try {
    plan = await opts.client.chatJSON({
      model: opts.model,
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(input),
      schema: structuralPlanSchema,
      timeoutMs: opts.timeoutMs ?? 20_000,
      maxRetries: 1,
      temperature: 0.1,
    });
  } catch (err) {
    if (err instanceof LLMTimeoutError) {
      return {
        kind: "gap",
        gap: makeAnalysisTimeoutGap(input.triggeringEdit.cardId),
      };
    }
    if (err instanceof LLMSchemaError) {
      return {
        kind: "gap",
        gap: makeAgentUnresolvableGap(
          input.triggeringEdit.cardId,
          "The agent returned a malformed plan and could not be auto-corrected.",
        ),
      };
    }
    if (err instanceof LLMTransportError) {
      return {
        kind: "gap",
        gap: makeAgentUnresolvableGap(
          input.triggeringEdit.cardId,
          "The reasoning service is unavailable. Try again shortly.",
        ),
      };
    }
    return {
      kind: "gap",
      gap: makeAgentUnresolvableGap(
        input.triggeringEdit.cardId,
        "An unexpected error occurred during planning.",
      ),
    };
  }

  // ── Post-LLM enforcement (defense in depth) ─────────────────────────────

  // 1. Sealed + any live_only op → instruction gap, regardless of model claim.
  if (input.systemMode === "sealed") {
    const hasLiveOnly = plan.operations.some(
      (op) => MUTATION_SCOPE_BY_TYPE[op.mutationType] === "live_only",
    );
    if (hasLiveOnly) {
      return {
        kind: "gap",
        gap: makeStructuralChangeInSealedGap(
          input.triggeringEdit.cardId,
          input.triggeringEdit.description,
        ),
      };
    }
  }

  // 2. Model self-declared unsafe.
  if (!plan.safetyAssessment.safe) {
    if (plan.safetyAssessment.reason === "live_only_in_sealed") {
      return {
        kind: "gap",
        gap: makeStructuralChangeInSealedGap(
          input.triggeringEdit.cardId,
          input.triggeringEdit.description,
        ),
      };
    }
    return {
      kind: "gap",
      gap: makeAgentUnresolvableGap(
        input.triggeringEdit.cardId,
        plan.safetyAssessment.reason ??
          "The change cannot be safely applied as authored.",
      ),
    };
  }

  // 3. Precedence violation flagged by the model.
  if (!plan.respectsPrecedence) {
    return {
      kind: "gap",
      gap: makeAgentUnresolvableGap(
        input.triggeringEdit.cardId,
        "The proposed change conflicts with a higher-precedence contract document.",
      ),
    };
  }

  return { kind: "approved_plan", plan };
}
