import { describe, it, expect, vi } from "vitest";
import { DualAgentOrchestrator } from "../DualAgentOrchestrator.js";
import { StubLLMClient, makeImpact, makeSpineGraph } from "./fixtures.js";

const PM = "deepseek-v3.2:cloud";
const CODER = "qwen3-coder:480b-cloud";

function approvedPlanResponder() {
  return () => ({
    intent: "Update prompt text",
    downstreamEffects: ["Re-validate downstream model card"],
    operations: [
      {
        mutationType: "update_config",
        cardId: "prompt-1",
        payloadSummary: { promptText: "hi" },
      },
    ],
    safetyAssessment: { safe: true },
    respectsPrecedence: true,
  });
}

function coderProposalResponder(
  overrides: { spineGraphVersion?: number; triggeredBy?: string } = {},
) {
  return () => ({
    triggeredBy: overrides.triggeredBy ?? "prompt-1",
    spineGraphVersion: overrides.spineGraphVersion ?? 1,
    mutations: [
      {
        cardId: "prompt-1",
        mutationType: "update_config",
        payload: { config: { promptText: "hi" } },
        allowedIn: "both",
      },
    ],
    userDescription: "Update prompt text",
    downstreamEffects: ["Re-validate downstream model card"],
  });
}

describe("DualAgentOrchestrator", () => {
  it("happy path: live-mode config edit produces a proposal", async () => {
    const pmClient = new StubLLMClient();
    const coderClient = new StubLLMClient();
    pmClient.enqueue(PM, approvedPlanResponder());
    coderClient.enqueue(
      CODER,
      coderProposalResponder({ spineGraphVersion: 42 }),
    );

    const orchestrator = new DualAgentOrchestrator({
      projectManagerClient: pmClient,
      coderClient,
    });

    const result = await orchestrator.run({
      spineGraph: makeSpineGraph({ version: 42 }),
      triggeringEdit: {
        cardId: "prompt-1",
        description: "edit prompt",
        intendedMutationTypes: ["update_config"],
      },
      impactAnalysis: makeImpact("prompt-1"),
      systemMode: "live",
    });

    expect(result.kind).toBe("proposal");
    if (result.kind === "proposal") {
      expect(result.proposal.spineGraphVersion).toBe(42);
      expect(result.proposal.triggeredBy).toBe("prompt-1");
      expect(result.proposal.mutations).toHaveLength(1);
    }
  });

  it("sealed-mode structural intent short-circuits before any LLM call", async () => {
    const pmClient = new StubLLMClient();
    const coderClient = new StubLLMClient();

    const orchestrator = new DualAgentOrchestrator({
      projectManagerClient: pmClient,
      coderClient,
    });

    const result = await orchestrator.run({
      spineGraph: makeSpineGraph(),
      triggeringEdit: {
        cardId: "prompt-1",
        description: "add a port",
        intendedMutationTypes: ["update_ports"],
      },
      impactAnalysis: makeImpact("prompt-1"),
      systemMode: "sealed",
    });

    expect(result.kind).toBe("gap");
    if (result.kind === "gap") {
      expect(result.gap.source).toBe("structural_change_in_sealed");
      expect(result.gap.severity).toBe("instruction");
    }
    expect(pmClient.calls).toHaveLength(0);
    expect(coderClient.calls).toHaveLength(0);
  });

  it("PM gap short-circuits the Coder step", async () => {
    const pmClient = new StubLLMClient();
    const coderClient = new StubLLMClient();
    // PM declares unsafe with non-sealed reason → blocking gap.
    pmClient.enqueue(PM, () => ({
      intent: "x",
      downstreamEffects: [],
      operations: [
        {
          mutationType: "update_config",
          cardId: "prompt-1",
          payloadSummary: {},
        },
      ],
      safetyAssessment: { safe: false, reason: "cannot_resolve" },
      respectsPrecedence: true,
    }));

    const orchestrator = new DualAgentOrchestrator({
      projectManagerClient: pmClient,
      coderClient,
    });

    const result = await orchestrator.run({
      spineGraph: makeSpineGraph(),
      triggeringEdit: {
        cardId: "prompt-1",
        description: "x",
        intendedMutationTypes: ["update_config"],
      },
      impactAnalysis: makeImpact("prompt-1"),
      systemMode: "live",
    });

    expect(result.kind).toBe("gap");
    expect(coderClient.calls).toHaveLength(0);
  });

  it("version is locked at entry: mutating spineGraph.version mid-run does not change proposal", async () => {
    const spineGraph = makeSpineGraph({ version: 5 });

    const pmClient = new StubLLMClient();
    const coderClient = new StubLLMClient();

    pmClient.enqueue(PM, async () => {
      // Simulate an external mutation racing with the agent.
      spineGraph.version = 99;
      return {
        intent: "x",
        downstreamEffects: [],
        operations: [
          {
            mutationType: "update_config",
            cardId: "prompt-1",
            payloadSummary: {},
          },
        ],
        safetyAssessment: { safe: true },
        respectsPrecedence: true,
      };
    });
    // Coder model also tries to use the post-race version — must be overridden.
    coderClient.enqueue(
      CODER,
      coderProposalResponder({ spineGraphVersion: 99 }),
    );

    const orchestrator = new DualAgentOrchestrator({
      projectManagerClient: pmClient,
      coderClient,
    });

    const result = await orchestrator.run({
      spineGraph,
      triggeringEdit: {
        cardId: "prompt-1",
        description: "x",
        intendedMutationTypes: ["update_config"],
      },
      impactAnalysis: makeImpact("prompt-1"),
      systemMode: "live",
    });

    expect(result.kind).toBe("proposal");
    if (result.kind === "proposal") {
      // The orchestrator captured version=5 at entry. Despite the race and the
      // coder lying about the version, the proposal must bind to 5.
      expect(result.proposal.spineGraphVersion).toBe(5);
    }
  });

  it("unexpected throw in coder is converted to a blocking gap (run never throws)", async () => {
    const pmClient = new StubLLMClient();
    const coderClient = new StubLLMClient();
    pmClient.enqueue(PM, approvedPlanResponder());
    coderClient.enqueue(CODER, () => () => {
      throw new Error("synthetic explosion");
    });

    const orchestrator = new DualAgentOrchestrator({
      projectManagerClient: pmClient,
      coderClient,
    });

    const result = await orchestrator.run({
      spineGraph: makeSpineGraph({ version: 1 }),
      triggeringEdit: {
        cardId: "prompt-1",
        description: "edit",
        intendedMutationTypes: ["update_config"],
      },
      impactAnalysis: makeImpact("prompt-1"),
      systemMode: "live",
    });

    // Per the contract, run() never throws — a generic throw becomes a blocking gap.
    expect(result.kind).toBe("gap");
    if (result.kind === "gap") {
      expect(result.gap.severity).toBe("blocking");
    }
  });

  it("does not leak provider error details (credentials, URLs) into the user-facing gap", async () => {
    // Provider errors regularly include the request URL, bearer token prefix,
    // and stack frames. None of that may surface in the gap context.
    const pmClient = new StubLLMClient();
    const coderClient = new StubLLMClient();
    pmClient.enqueue(PM, approvedPlanResponder());
    coderClient.enqueue(CODER, () => () => {
      throw new Error(
        "Bearer sk-secret-xyz failed at https://provider.example/v1/chat",
      );
    });

    // Suppress server-side log noise without losing visibility.
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const orchestrator = new DualAgentOrchestrator({
      projectManagerClient: pmClient,
      coderClient,
    });

    const result = await orchestrator.run({
      spineGraph: makeSpineGraph({ version: 1 }),
      triggeringEdit: {
        cardId: "prompt-1",
        description: "edit",
        intendedMutationTypes: ["update_config"],
      },
      impactAnalysis: makeImpact("prompt-1"),
      systemMode: "live",
    });

    expect(result.kind).toBe("gap");
    if (result.kind === "gap") {
      expect(result.gap.context).not.toContain("sk-secret");
      expect(result.gap.context).not.toContain("Bearer");
      expect(result.gap.context).not.toContain("https");
      expect(result.gap.context).not.toContain("provider.example");
    }
    errSpy.mockRestore();
  });
});
