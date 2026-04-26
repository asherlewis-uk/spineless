import { describe, it, expect } from "vitest";
import {
  redactCardForPrompt,
  redactGraphForPrompt,
} from "../promptRedaction.js";
import { makeCard, makeSpineGraph } from "./fixtures.js";

describe("promptRedaction", () => {
  it("replaces config keys matching sensitive ports with [REDACTED-SENSITIVE]", () => {
    const card = makeCard({
      id: "input-1",
      type: "input",
      ports: [
        {
          id: "p-email",
          label: "email",
          type: "text",
          required: true,
          direction: "output",
          sensitive: true,
        },
        {
          id: "p-name",
          label: "name",
          type: "text",
          required: true,
          direction: "output",
          sensitive: false,
        },
      ],
      config: {
        email: "user@example.com",
        name: "Asher",
        nested: { email: "deep@example.com", note: "ok" },
      },
    });

    const redacted = redactCardForPrompt(card);
    expect(redacted.config["email"]).toBe("[REDACTED-SENSITIVE]");
    expect(redacted.config["name"]).toBe("Asher");
    const nested = redacted.config["nested"] as Record<string, unknown>;
    expect(nested["email"]).toBe("[REDACTED-SENSITIVE]");
    expect(nested["note"]).toBe("ok");
  });

  it("replaces secretRefs[].secretKey but preserves purpose and requiredBy", () => {
    const card = makeCard({
      id: "model-1",
      type: "model",
      secretRefs: [
        {
          secretKey: "OPENAI_API_KEY",
          requiredBy: "model-1",
          purpose: "OpenAI API key",
        },
      ],
    });

    const redacted = redactCardForPrompt(card);
    expect(redacted.secretRefs?.[0]?.secretKey).toBe("[REDACTED-SECRET]");
    expect(redacted.secretRefs?.[0]?.purpose).toBe("OpenAI API key");
    expect(redacted.secretRefs?.[0]?.requiredBy).toBe("model-1");
  });

  it("drops rawResponse anywhere it appears in config", () => {
    const card = makeCard({
      id: "model-1",
      type: "model",
      config: {
        rawResponse: "should be dropped",
        nested: { rawResponse: "also dropped", keep: 1 },
      },
    });

    const redacted = redactCardForPrompt(card);
    expect("rawResponse" in redacted.config).toBe(false);
    const nested = redacted.config["nested"] as Record<string, unknown>;
    expect("rawResponse" in nested).toBe(false);
    expect(nested["keep"]).toBe(1);
  });

  it("leaves non-sensitive cards unchanged", () => {
    const card = makeCard({
      id: "logic-1",
      type: "logic",
      config: { threshold: 0.5, branches: ["a", "b"] },
    });

    const redacted = redactCardForPrompt(card);
    expect(redacted.config).toEqual({ threshold: 0.5, branches: ["a", "b"] });
  });

  it("redactGraphForPrompt redacts every card", () => {
    const sensitiveCard = makeCard({
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
      config: { token: "sk-abc" },
    });
    const graph = makeSpineGraph({ cards: [sensitiveCard] });
    const redacted = redactGraphForPrompt(graph);
    expect(redacted.cards["input-1"]?.config["token"]).toBe(
      "[REDACTED-SENSITIVE]",
    );
  });
});
