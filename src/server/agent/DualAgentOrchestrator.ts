// DualAgentOrchestrator
//
// The single entry point for the AgentRuntime's two-tier LLM workflow.
// Step 1 (DeepSeek "Project Manager") evaluates safety + precedence and
// emits a strict structural plan or aborts with a GapCardSpec.
// Step 2 (Qwen "Coder") translates the approved plan into a fully typed
// SpineMutationProposal with version-locked, server-authoritative fields.
//
// Invariants:
//   • The agent NEVER mutates source files. It returns a SpineMutationProposal
//     that the spine store applies.
//   • `spineGraphVersion` is captured ONCE at orchestrator entry. Mid-run
//     mutations to the input graph cannot change this value.
//   • `run()` NEVER throws. Every failure path resolves to a GapCardSpec.
//   • Sealed-mode structural mutations are converted to instruction Gap Cards
//     before reaching the user (and before the LLM call when possible).

import type {
  ImpactAnalysisResult,
  SpineGraph,
  SpineMutationProposal,
  SystemMode,
} from "../../contracts/index.js";
import type { GapCardSpec } from "../../contracts/gap.js";
import type { LLMClient } from "../llm/types.js";
import { makeAgentUnresolvableGap } from "./gapFactory.js";
import {
  runProjectManagerStep,
  type ProjectManagerInput,
  type TriggeringEdit,
} from "./projectManagerStep.js";
import { runCoderStep } from "./coderStep.js";

// ─── Public Types ────────────────────────────────────────────────────────────

export interface OrchestratorInput {
  spineGraph: SpineGraph;
  triggeringEdit: TriggeringEdit;
  impactAnalysis: ImpactAnalysisResult;
  systemMode: SystemMode;
}

export type OrchestratorResult =
  | { kind: "proposal"; proposal: SpineMutationProposal }
  | { kind: "gap"; gap: GapCardSpec };

export interface DualAgentOrchestratorOptions {
  /** LLM client for the Project Manager (DeepSeek) step. */
  projectManagerClient: LLMClient;
  /** LLM client for the Coder (Qwen) step. May be the same instance. */
  coderClient: LLMClient;
  /** Defaults to 'deepseek-v3.2:cloud'. */
  projectManagerModel?: string;
  /** Defaults to 'qwen3-coder:480b-cloud'. */
  coderModel?: string;
  /** Per-step LLM timeout in ms. Defaults to 20_000. */
  stepTimeoutMs?: number;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class DualAgentOrchestrator {
  private readonly pmClient: LLMClient;
  private readonly coderClient: LLMClient;
  private readonly pmModel: string;
  private readonly coderModel: string;
  private readonly stepTimeoutMs: number;

  constructor(opts: DualAgentOrchestratorOptions) {
    this.pmClient = opts.projectManagerClient;
    this.coderClient = opts.coderClient;
    this.pmModel = opts.projectManagerModel ?? "deepseek-v3.2:cloud";
    this.coderModel = opts.coderModel ?? "qwen3-coder:480b-cloud";
    this.stepTimeoutMs = opts.stepTimeoutMs ?? 20_000;
  }

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    // Capture the version-lock anchor exactly once at entry.
    const lockedSpineGraphVersion = input.spineGraph.version;
    const triggeringCardId = input.triggeringEdit.cardId;

    try {
      const pmInput: ProjectManagerInput = {
        spineGraph: input.spineGraph,
        triggeringEdit: input.triggeringEdit,
        impactAnalysis: input.impactAnalysis,
        systemMode: input.systemMode,
        spineGraphVersion: lockedSpineGraphVersion,
      };

      const pmOutput = await runProjectManagerStep(pmInput, {
        client: this.pmClient,
        model: this.pmModel,
        timeoutMs: this.stepTimeoutMs,
      });

      if (pmOutput.kind === "gap") {
        return { kind: "gap", gap: pmOutput.gap };
      }

      const coderOutput = await runCoderStep(
        {
          plan: pmOutput.plan,
          spineGraph: input.spineGraph,
          lockedSpineGraphVersion,
          triggeringCardId,
        },
        {
          client: this.coderClient,
          model: this.coderModel,
          timeoutMs: this.stepTimeoutMs,
        },
      );

      if (coderOutput.kind === "gap") {
        return { kind: "gap", gap: coderOutput.gap };
      }

      // Final belt-and-braces: ensure the proposal carries the locked version.
      // The Coder step already overwrites this, but we re-assert defensively.
      const proposal: SpineMutationProposal = {
        ...coderOutput.proposal,
        spineGraphVersion: lockedSpineGraphVersion,
        triggeredBy: triggeringCardId,
      };

      return { kind: "proposal", proposal };
    } catch (err) {
      // run() must never throw. Convert any unexpected failure into a blocking gap.
      // Provider error messages may leak credentials, URLs, or stack traces —
      // they are logged server-side only, never propagated to the user-facing gap.
      console.error("[DualAgentOrchestrator] unexpected failure:", err);
      return {
        kind: "gap",
        gap: makeAgentUnresolvableGap(
          triggeringCardId,
          "The agent runtime hit an internal error. No changes were made.",
        ),
      };
    }
  }
}
