// Canonical types — transcribed from docs/spineless_09_contract_hardening.md
// (Consolidated Final Type System) with overrides from docs/spineless_10_contract_hardening.md.
// Doc 10 controls where it conflicts with doc 09.

// ─── System-Level Types ───────────────────────────────────────────────────────

export type SystemMode = "live" | "sealed";

export type LifecycleStage =
  | "idle"
  | "editing"
  | "impact_analysis"
  | "suggestions_visible"
  | "agent_invoked"
  | "confirming"
  | "spine_mutating"
  | "compiling"
  | "live_runtime_updating"
  | "pending_change_queued"
  | "release_validating"
  | "release_compiling"
  | "release_deploying"
  | "snapshot_updating"
  | "spine_settled";

// ─── Card Types ──────────────────────────────────────────────────────────────

export type CardType =
  | "input"
  | "prompt"
  | "model"
  | "tool"
  | "memory"
  | "logic"
  | "output"
  | "eval"
  | "gap";

export const CARD_TYPES: readonly CardType[] = [
  "input",
  "prompt",
  "model",
  "tool",
  "memory",
  "logic",
  "output",
  "eval",
  "gap",
] as const;

export type CardState =
  | "idle"
  | "editing"
  | "active"
  | "passing"
  | "error"
  | "sealed_error"
  | "affected"
  | "needs_resolution"
  | "confirming"
  | "sealed"
  | "unresolved"
  | "pending"
  | "analysis";

// ─── Port Types ──────────────────────────────────────────────────────────────

// 'secret' is NOT a PortType. Secrets never enter port flow.
export type PortType =
  | "text"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "any";

export const PORT_TYPES: readonly PortType[] = [
  "text",
  "number",
  "boolean",
  "object",
  "array",
  "any",
] as const;

export interface Port {
  id: string;
  label: string;
  type: PortType;
  schema?: Record<string, PortType>;
  required: boolean;
  direction: "input" | "output";
  /** true = values redacted in execution traces; for user data only */
  sensitive: boolean;
}

export interface CardSecretReference {
  secretKey: string;
  requiredBy: string;
  purpose: string;
}

// ─── Graph Types ─────────────────────────────────────────────────────────────

/**
 * CardConfig is type-specific and varies by CardType. The orchestrator never
 * inspects its internals — it forwards opaque payload shapes from the agent.
 */
export type CardConfig = Record<string, unknown>;

export interface SpinePosition {
  depth: number;
  track: number;
  zOffset: number;
}

export interface Card {
  id: string;
  type: CardType;
  state: CardState;
  config: CardConfig;
  ports: Port[];
  secretRefs?: CardSecretReference[];
  position: SpinePosition;
  createdAt: number;
  updatedAt: number;
}

export interface Connection {
  id: string;
  sourceCardId: string;
  sourcePortId: string;
  targetCardId: string;
  targetPortId: string;
  valid: boolean;
  evalCardId?: string;
}

export interface SpineGraph {
  id: string;
  cards: Record<string, Card>;
  connections: Record<string, Connection>;
  executionOrder: string[];
  version: number;
  updatedAt: number;
}
