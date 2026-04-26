// Prompt redaction layer.
//
// LLMs are third-party trust boundaries. Per doc 10 §7:
//   • Rule 1 — secret values never leave the secrets store.
//   • Rule 3 — port.sensitive=true fields are stored/transmitted as [REDACTED].
//   • Rule 3a — rawResponse is never user/model-facing.
//
// Both agent steps serialize cards into the LLM user prompt. This module
// produces a sanitized view of a Card / SpineGraph that is safe to send.

import type { Card, SpineGraph } from "../../contracts/index.js";

const SENSITIVE_PLACEHOLDER = "[REDACTED-SENSITIVE]";
const SECRET_PLACEHOLDER = "[REDACTED-SECRET]";

/**
 * Returns a shallow-cloned card whose:
 *   • config keys matching any sensitive port (by id or label) are replaced.
 *   • config.rawResponse and any nested `rawResponse` key is dropped.
 *   • secretRefs[].secretKey values are replaced with a placeholder
 *     (purpose / requiredBy preserved — they are not values).
 */
export function redactCardForPrompt(card: Card): Card {
  const sensitiveKeys = new Set<string>();
  for (const port of card.ports) {
    if (port.sensitive) {
      sensitiveKeys.add(port.id);
      sensitiveKeys.add(port.label);
    }
  }

  const config = redactConfigShape(card.config, sensitiveKeys);

  const secretRefs = card.secretRefs?.map((ref) => ({
    ...ref,
    secretKey: SECRET_PLACEHOLDER,
  }));

  // Drop optional fields rather than set them to undefined to satisfy
  // exactOptionalPropertyTypes.
  const redacted: Card = {
    ...card,
    config,
    ...(secretRefs !== undefined ? { secretRefs } : {}),
  };
  return redacted;
}

/**
 * Returns a SpineGraph-shaped object with each card redacted. Cards are
 * passed through `redactCardForPrompt`; connections, executionOrder, and
 * top-level metadata are left intact (they contain no values).
 */
export function redactGraphForPrompt(graph: SpineGraph): SpineGraph {
  const cards: Record<string, Card> = {};
  for (const [id, card] of Object.entries(graph.cards)) {
    cards[id] = redactCardForPrompt(card);
  }
  return { ...graph, cards };
}

// ─── Internal ────────────────────────────────────────────────────────────────

function redactConfigShape(
  value: unknown,
  sensitiveKeys: Set<string>,
): Record<string, unknown> {
  if (!isPlainObject(value)) {
    // Defensive — config is typed as Record<string, unknown>.
    return {};
  }
  return redactObject(value, sensitiveKeys) as Record<string, unknown>;
}

function redactObject(
  obj: Record<string, unknown>,
  sensitiveKeys: Set<string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    // Doc 10 §3 / Rule 3a: rawResponse is never model- or user-facing.
    if (key === "rawResponse") continue;
    if (sensitiveKeys.has(key)) {
      out[key] = SENSITIVE_PLACEHOLDER;
      continue;
    }
    out[key] = redactValue(val, sensitiveKeys);
  }
  return out;
}

function redactValue(value: unknown, sensitiveKeys: Set<string>): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, sensitiveKeys));
  }
  if (isPlainObject(value)) {
    return redactObject(value, sensitiveKeys);
  }
  return value;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
