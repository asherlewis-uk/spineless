import { describe, it, expect } from "vitest";
import { runProjectManagerStep } from "../projectManagerStep.js";
import { LLMTimeoutError, LLMSchemaError } from "../../llm/types.js";
import {
  StubLLMClient,
  makeCard,
  makeImpact,
  makeSpineGraph,
} from "./fixtures.js";

const PM_MODEL = "deepseek-v3.2:cloud";

describe("projectManagerStep", () => {
  it("short-circuits to instruction Gap when sealed + intended live_only mutation", async () => {
    const client = new StubLLMClient();
    // No responder queued — proves the LLM is never called.
    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "add a port",
          intendedMutationTypes: ["update_ports"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "sealed",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("gap");
    if (out.kind === "gap") {
      expect(out.gap.source).toBe("structural_change_in_sealed");
      expect(out.gap.severity).toBe("instruction");
      expect(out.gap.deferrable).toBe(true);
    }
    expect(client.calls).toHaveLength(0);
  });

  it("returns approved_plan on a valid live-mode response", async () => {
    const client = new StubLLMClient();
    client.enqueue(PM_MODEL, () => ({
      intent: "Update prompt text",
      downstreamEffects: ["Model card may need re-validation"],
      operations: [
        {
          mutationType: "update_config",
          cardId: "prompt-1",
          payloadSummary: { promptText: "new text" },
        },
      ],
      safetyAssessment: { safe: true },
      respectsPrecedence: true,
    }));

    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "edit prompt",
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "live",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("approved_plan");
  });

  it("overrides model output: sealed + live_only op in plan still produces instruction gap", async () => {
    const client = new StubLLMClient();
    // Model lies — claims safe, but emits a live_only operation while sealed.
    client.enqueue(PM_MODEL, () => ({
      intent: "Add a port",
      downstreamEffects: [],
      operations: [
        {
          mutationType: "update_ports",
          cardId: "prompt-1",
          payloadSummary: {},
        },
      ],
      safetyAssessment: { safe: true },
      respectsPrecedence: true,
    }));

    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "add a port",
          // intent says config so pre-LLM check passes — but model returns live_only
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "sealed",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("gap");
    if (out.kind === "gap") {
      expect(out.gap.source).toBe("structural_change_in_sealed");
    }
  });

  it("converts model-declared unsafe (live_only_in_sealed) into instruction gap", async () => {
    const client = new StubLLMClient();
    client.enqueue(PM_MODEL, () => ({
      intent: "blocked",
      downstreamEffects: [],
      operations: [
        {
          mutationType: "update_config",
          cardId: "prompt-1",
          payloadSummary: {},
        },
      ],
      safetyAssessment: { safe: false, reason: "live_only_in_sealed" },
      respectsPrecedence: true,
    }));

    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "x",
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "sealed",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("gap");
    if (out.kind === "gap") {
      expect(out.gap.source).toBe("structural_change_in_sealed");
    }
  });

  it("converts precedence violations into agent_unresolvable blocking gap", async () => {
    const client = new StubLLMClient();
    client.enqueue(PM_MODEL, () => ({
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
      respectsPrecedence: false,
    }));

    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "x",
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "live",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("gap");
    if (out.kind === "gap") {
      expect(out.gap.source).toBe("agent_unresolvable");
      expect(out.gap.severity).toBe("blocking");
    }
  });

  it("maps LLM timeout to analysis_timeout warning gap", async () => {
    const client = new StubLLMClient();
    client.enqueue(PM_MODEL, () => () => {
      throw new LLMTimeoutError("timeout", PM_MODEL);
    });

    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "x",
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "live",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("gap");
    if (out.kind === "gap") {
      expect(out.gap.source).toBe("analysis_timeout");
      expect(out.gap.severity).toBe("warning");
    }
  });

  it("maps LLM schema error to agent_unresolvable blocking gap", async () => {
    const client = new StubLLMClient();
    client.enqueue(PM_MODEL, () => () => {
      throw new LLMSchemaError("bad shape", PM_MODEL, "{}");
    });

    const out = await runProjectManagerStep(
      {
        spineGraph: makeSpineGraph(),
        triggeringEdit: {
          cardId: "prompt-1",
          description: "x",
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "live",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );
    expect(out.kind).toBe("gap");
    if (out.kind === "gap") {
      expect(out.gap.source).toBe("agent_unresolvable");
      expect(out.gap.severity).toBe("blocking");
    }
  });

  it("redacts sensitive config + secret keys and scopes executionOrder before sending to LLM", async () => {
    const client = new StubLLMClient();
    client.enqueue(PM_MODEL, () => ({
      intent: "ok",
      downstreamEffects: [],
      operations: [],
      safetyAssessment: { safe: true },
      respectsPrecedence: true,
    }));

    const inputCard = makeCard({
      id: "input-1",
      type: "input",
      ports: [
        {
          id: "p-token",
          label: "token",
          type: "text",
          required: true,
          direction: "output",
          sensitive: true,
        },
      ],
      config: { token: "sk-leaked-value" },
    });
    const promptCard = makeCard({
      id: "prompt-1",
      type: "prompt",
      secretRefs: [
        {
          secretKey: "OPENAI_API_KEY",
          requiredBy: "prompt-1",
          purpose: "model auth",
        },
      ],
    });
    const farCard = makeCard({ id: "far-1", type: "output" });
    const baseGraph = makeSpineGraph({
      cards: [inputCard, promptCard, farCard],
    });
    // Connect input-1 → prompt-1 so input-1 enters the 1-hop neighborhood.
    // far-1 is intentionally disconnected so we can prove it is filtered out.
    const graph = {
      ...baseGraph,
      connections: {
        "c-1": {
          id: "c-1",
          sourceCardId: "input-1",
          sourcePortId: "p-token",
          targetCardId: "prompt-1",
          targetPortId: "p-in",
          valid: true,
        },
      },
    };

    await runProjectManagerStep(
      {
        spineGraph: graph,
        triggeringEdit: {
          cardId: "prompt-1",
          description: "edit",
          intendedMutationTypes: ["update_config"],
        },
        impactAnalysis: makeImpact("prompt-1"),
        systemMode: "live",
        spineGraphVersion: 1,
      },
      { client, model: PM_MODEL },
    );

    expect(client.calls).toHaveLength(1);
    const userPrompt = client.calls[0]!.user;
    // Sensitive port value is redacted.
    expect(userPrompt).not.toContain("sk-leaked-value");
    expect(userPrompt).toContain("[REDACTED-SENSITIVE]");
    // Secret keys are redacted.
    expect(userPrompt).not.toContain("OPENAI_API_KEY");
    expect(userPrompt).toContain("[REDACTED-SECRET]");
    // executionOrder is scoped to neighborhood — far-1 is not connected to prompt-1.
    expect(userPrompt).not.toContain("far-1");
    expect(userPrompt).toContain("prompt-1");
  });
});
