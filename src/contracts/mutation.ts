// Mutation contract types — doc 09 §Consolidated Final Type System,
// doc 10 §6 (version locking on SpineMutationProposal).

import type { Card, Connection } from "./spine.js";

export type MutationScope = "live_only" | "both";

export type SpineMutationType =
  | "update_config"
  | "update_ports"
  | "update_output_schema"
  | "add_card"
  | "remove_card"
  | "add_connection"
  | "remove_connection"
  | "resolve_gap"
  | "rotate_secret";

export const SPINE_MUTATION_TYPES: readonly SpineMutationType[] = [
  "update_config",
  "update_ports",
  "update_output_schema",
  "add_card",
  "remove_card",
  "add_connection",
  "remove_connection",
  "resolve_gap",
  "rotate_secret",
] as const;

/**
 * Single source of truth for which mutations are allowed in which SystemMode.
 * Derived from doc 10 §3 / doc 08 §3.
 *
 * Used to:
 *   1. Enforce sealed-state structural blocking (post-LLM defense in depth).
 *   2. Re-stamp `allowedIn` on every mutation returned by the Coder LLM,
 *      so the model cannot lie about scope.
 */
export const MUTATION_SCOPE_BY_TYPE: Record<SpineMutationType, MutationScope> =
  {
    update_config: "both",
    update_ports: "live_only",
    update_output_schema: "live_only",
    add_card: "live_only",
    remove_card: "live_only",
    add_connection: "live_only",
    remove_connection: "live_only",
    resolve_gap: "both",
    rotate_secret: "both",
  };

export interface SpineMutation {
  cardId: string;
  mutationType: SpineMutationType;
  payload: Partial<Card> | Partial<Connection>;
  allowedIn: MutationScope;
}

export interface SpineMutationProposal {
  triggeredBy: string;
  /** version at agent invocation — server stale-checks at confirmation */
  spineGraphVersion: number;
  mutations: SpineMutation[];
  userDescription: string;
  downstreamEffects: string[];
}

import type { SpineGraph } from "./spine.js";

export interface MutationRequest {
  spineId: string;
  clientSpineVersion: number;
  proposal: SpineMutationProposal;
}

export interface MutationRejection {
  reason: "version_mismatch";
  serverVersion: number;
  latestSpineGraph: SpineGraph;
}
