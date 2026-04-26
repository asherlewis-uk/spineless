// Impact analysis types — doc 09 §Consolidated Final Type System.

import type { CardConfig } from "./spine.js";

export interface AffectedCard {
  cardId: string;
  severity: "conflict" | "risk" | "adjustment";
  reason: string;
}

export interface ResolutionSuggestion {
  affectedCardId: string;
  description: string;
  mutationType: "schema_update" | "config_update" | "connection_update";
  mutation: Partial<CardConfig>;
}

export interface ImpactAnalysisResult {
  triggeredBy: string;
  affected: AffectedCard[];
  suggestions: ResolutionSuggestion[];
  hasUnresolvable: boolean;
}
