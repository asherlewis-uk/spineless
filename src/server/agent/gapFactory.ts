// Centralized GapCardSpec construction.
//
// Every error path in the agent runtime resolves to one of these, so the
// orchestrator surface is exhaustive: { kind: 'proposal' } | { kind: 'gap' }.
// Severity and `source` follow doc 09 §Consolidated Final Type System and
// doc 10 §1/§3 (sealed-state structural blocking is `instruction`, deferrable).

import type { GapCardSpec } from "../../contracts/gap.js";

const STRUCTURAL_IN_SEALED_MESSAGE =
  "This change requires structural editing. Return to Live to continue.";

export function makeStructuralChangeInSealedGap(
  triggeringCardId: string,
  userIntent: string,
): GapCardSpec {
  return {
    insertAfterCardId: triggeringCardId,
    question: STRUCTURAL_IN_SEALED_MESSAGE,
    context: `You attempted: ${userIntent}. Structural changes are not permitted while the system is Sealed.`,
    suggestedAction: "Return to Live to apply this change.",
    severity: "instruction",
    deferrable: true,
    source: "structural_change_in_sealed",
  };
}

export function makeAnalysisTimeoutGap(triggeringCardId: string): GapCardSpec {
  return {
    insertAfterCardId: triggeringCardId,
    question: "The agent took too long to analyze this change.",
    context:
      "Reasoning timed out before a safe plan could be produced. Your spine is unchanged.",
    suggestedAction: "Try again, or simplify the edit and retry.",
    severity: "warning",
    deferrable: true,
    source: "analysis_timeout",
  };
}

export function makeAgentUnresolvableGap(
  triggeringCardId: string,
  reason: string,
): GapCardSpec {
  return {
    insertAfterCardId: triggeringCardId,
    question: "The agent could not produce a safe change.",
    context: reason,
    suggestedAction:
      "Adjust the edit, or apply the change manually before retrying.",
    severity: "blocking",
    deferrable: false,
    source: "agent_unresolvable",
  };
}

/**
 * Sanitize an untrusted string (model-controlled or error message) before
 * embedding it into a user-visible Gap context.
 *
 * Strips control characters and newlines, replaces angle brackets to
 * neutralize any future markdown/HTML rendering surprises, and truncates
 * to a fixed length so prompt-injected payloads cannot dominate the card face.
 */
export function safeQuoteForGap(s: string, maxLength = 64): string {
  // eslint-disable-next-line no-control-regex
  const stripped = s.replace(/[\u0000-\u001F\u007F]/g, " ");
  const escaped = stripped.replace(/</g, "[").replace(/>/g, "]");
  const collapsed = escaped.replace(/\s+/g, " ").trim();
  if (collapsed.length <= maxLength) return collapsed;
  return `${collapsed.slice(0, maxLength)}…`;
}
