// Gap Card types — doc 09 §Consolidated Final Type System.
// Gap Cards are system-generated only. Severity governs whether compilation/Release is blocked.

import type { Card } from "./spine.js";

export type GapSeverity = "blocking" | "warning" | "instruction";

export type GapSource =
  | "compiler_failure"
  | "analysis_timeout"
  | "structural_change_in_sealed"
  | "agent_unresolvable"
  | "pending_change_conflict"
  | "deferred_design_decision";

export interface GapCardSpec {
  insertAfterCardId: string;
  question: string;
  context: string;
  suggestedAction: string;
  severity: GapSeverity;
  deferrable: boolean;
  source: GapSource;
}

export interface GapCard extends Card {
  type: "gap";
  spec: GapCardSpec;
  resolvedAt?: number;
  resolvedBy?: "user_action" | "deferred" | "auto_resolved";
}
