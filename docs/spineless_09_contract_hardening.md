# Spineless — Contract Hardening

**Version 1.0 | Source of Truth**

---

> **Scope note:** Document 11 supersedes this document wherever final v1 implementation contracts conflict with the application-flow spine reframe.

---

## Purpose

This document confirms the resolved state of contract decisions across the Spineless v1 documentation set. It serves as a precision layer and implementation freeze declaration for documents 01-08. Document 10 is the final hardening and precedence layer and controls wherever it conflicts with this document.

---

## Consolidated Final Type System

This is the authoritative version of every type in Spineless v1 except where document 10 supersedes it. Use this section as the primary type reference for documents 01-08. Do not reconcile types across earlier documents — this section supersedes all prior definitions from documents 01-08.

```typescript
// ─── System-Level Types ───────────────────────────────────────────────────────

type SystemMode = "live" | "sealed";

type LifecycleStage =
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

type CardType =
  | "input"
  | "prompt"
  | "model"
  | "tool"
  | "memory"
  | "logic"
  | "output"
  | "eval"
  | "gap";

type CardState =
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
// Use CardSecretReference for credential management.
type PortType = "text" | "number" | "boolean" | "object" | "array" | "any";

interface Port {
  id: string;
  label: string;
  type: PortType;
  schema?: Record<string, PortType>;
  required: boolean;
  direction: "input" | "output";
  sensitive: boolean; // true = values redacted in execution traces; for user data only
}

// Secrets are credentials, not port values — managed separately
interface CardSecretReference {
  secretKey: string; // key in the Spineless encrypted secrets store
  requiredBy: string; // card ID
  purpose: string; // plain language: "OpenAI API key for this model"
}

// ─── Card Config Types ───────────────────────────────────────────────────────
// CardConfig is a discriminated union on cardType.
// Each member is derived from the per-card authoring spec in doc 08 §8.
// Sealed-state editability per doc 08 §8 governs which fields the agent
// may include in update_config mutations.

interface InputCardFieldDef {
  name: string;
  type: PortType;
  validationRules?: string[]; // e.g. ["required", "max:256"]
}

interface InputCardConfig {
  cardType: "input";
  fields: InputCardFieldDef[];
  deliveryMethod: "api" | "webhook" | "form"; // default 'api'
}

interface PromptCardConfig {
  cardType: "prompt";
  template: string; // min 1 char
  systemPrompt?: string; // collapsed by default
  outputSchema: Record<string, PortType>; // min 1 field
}

interface ModelCardConfig {
  cardType: "model";
  modelId: string;
  temperature: number; // 0–2, default 1.0
  maxTokens?: number;
  retryCount: number; // default 2
  timeoutSeconds: number; // default 30
  jsonMode: boolean; // auto-enabled when Prompt Card has output schema
}

interface ToolCardConfig {
  cardType: "tool";
  name: string;
  executionTarget: string; // API endpoint URL or built-in tool identifier
  timeoutOverride?: number;
}

interface MemoryCardConfig {
  cardType: "memory";
  retentionStrategy: string;
  retentionWindow?: number;
  externalStoreRef?: string; // reference key into secrets store for external store
}

interface LogicCondition {
  expression: string; // evaluated against upstream output schema fields
  branchLabel: string;
  isDefault?: boolean;
}

interface LogicCardConfig {
  cardType: "logic";
  conditions: LogicCondition[]; // min 1; min 2 output connections required at spine level
}

interface OutputCardConfig {
  cardType: "output";
  destination: string; // e.g. 'slack', 'email', 'webhook', 'api_response'
  format: string;
  destinationConfig?: Record<string, unknown>; // channel, address, etc.
  responseSchema?: Record<string, PortType>; // for API response destinations
}

interface EvalExample {
  input: Record<string, unknown>;
  expectedOutput: Record<string, unknown>;
}

interface EvalCardConfig {
  cardType: "eval";
  examples: EvalExample[]; // min 1
  assertionRules?: string[];
  passThreshold: number; // 0–1, default 0.8
  driftAlertThreshold?: number;
}

// Gap Cards are system-generated only — no user-configurable config fields.
// Runtime spec is stored as GapCardSpec on the GapCard extension interface.
interface GapCardConfig {
  cardType: "gap";
}

type CardConfig =
  | InputCardConfig
  | PromptCardConfig
  | ModelCardConfig
  | ToolCardConfig
  | MemoryCardConfig
  | LogicCardConfig
  | OutputCardConfig
  | EvalCardConfig
  | GapCardConfig;

// ─── Graph Types ─────────────────────────────────────────────────────────────

interface Card {
  id: string;
  type: CardType;
  state: CardState;
  config: CardConfig; // discriminated union — see CardConfig above; cardType must match Card.type
  ports: Port[];
  secretRefs?: CardSecretReference[];
  position: SpinePosition;
  createdAt: number;
  updatedAt: number;
}

interface SpinePosition {
  depth: number; // scroll position in spine
  track: number; // parallel track (0 = main, 1+ = branches)
  zOffset: number; // z-depth for parallax
}

interface Connection {
  id: string;
  sourceCardId: string;
  sourcePortId: string;
  targetCardId: string;
  targetPortId: string;
  valid: boolean;
  evalCardId?: string; // if an Eval Card wraps this connection
}

interface SpineGraph {
  id: string;
  cards: Record<string, Card>;
  connections: Record<string, Connection>;
  executionOrder: string[]; // card IDs in topological order
  version: number;
  updatedAt: number;
}

// ─── Agent Types ─────────────────────────────────────────────────────────────

type MutationScope = "live_only" | "both";

interface SpineMutation {
  cardId: string;
  mutationType:
    | "update_config" // both — allowed in Live and Sealed
    | "update_ports" // live_only
    | "update_output_schema" // live_only
    | "add_card" // live_only
    | "remove_card" // live_only
    | "add_connection" // live_only
    | "remove_connection" // live_only
    | "resolve_gap" // both
    | "rotate_secret"; // both
  payload: Partial<Card> | Partial<Connection>;
  allowedIn: MutationScope;
}

interface SpineMutationProposal {
  triggeredBy: string;
  spineGraphVersion: number; // version at agent invocation — stale check at confirmation
  mutations: SpineMutation[];
  userDescription: string; // plain language summary for confirmation panel
  downstreamEffects: string[]; // plain language list
}

// ─── Impact Analysis Types ───────────────────────────────────────────────────

interface ImpactAnalysisResult {
  triggeredBy: string;
  affected: AffectedCard[];
  suggestions: ResolutionSuggestion[];
  hasUnresolvable: boolean;
}

interface AffectedCard {
  cardId: string;
  severity: "conflict" | "risk" | "adjustment";
  reason: string;
}

interface ResolutionSuggestion {
  affectedCardId: string;
  description: string;
  mutationType: "schema_update" | "config_update" | "connection_update";
  mutation: Partial<CardConfig>;
}

// ─── Gap Card Types ───────────────────────────────────────────────────────────

type GapSeverity = "blocking" | "warning" | "instruction";

interface GapCardSpec {
  insertAfterCardId: string;
  question: string;
  context: string;
  suggestedAction: string;
  severity: GapSeverity;
  deferrable: boolean;
  source:
    | "compiler_failure"
    | "analysis_timeout"
    | "structural_change_in_sealed"
    | "agent_unresolvable"
    | "pending_change_conflict"
    | "deferred_design_decision";
}

interface GapCard extends Card {
  type: "gap";
  spec: GapCardSpec;
  resolvedAt?: number;
  resolvedBy?: "user_action" | "deferred" | "auto_resolved";
}

// ─── Snapshot and Pending Change Types ──────────────────────────────────────

interface SealedSnapshot {
  id: string;
  spineGraph: SpineGraph;
  compiledProjectHash: string;
  vercelDeploymentId: string;
  vercelProductionUrl: string;
  sealedAt: number;
}

interface PendingChange {
  id: string;
  baseSnapshotId: string; // SealedSnapshot ID when change was queued
  targetCardId: string;
  targetConfigPath: string; // dot-notation path within CardConfig
  mutation: SpineMutation;
  userDescription: string;
  createdAt: number;
  status:
    | "queued"
    | "rebased"
    | "conflicted"
    | "included_in_release"
    | "rejected";
}

// ─── Mutation Request / Version Guard ────────────────────────────────────────

interface MutationRequest {
  spineId: string;
  clientSpineVersion: number;
  proposal: SpineMutationProposal;
}

interface MutationRejection {
  reason: "version_mismatch";
  serverVersion: number;
  latestSpineGraph: SpineGraph;
}

// ─── Execution Types ─────────────────────────────────────────────────────────

interface PromptDeclaration {
  template: string;
  variables: Record<string, PortType>;
  declaredOutputSchema: Record<string, PortType>;
}

interface PromptToModelPayload {
  compiledPrompt: string;
  declaredOutputSchema: Record<string, PortType>;
}

interface ModelOutputPayload {
  values: Record<string, unknown>;
  rawResponse?: string; // not persisted if any declared output field is sensitive unless schema-redacted; never user-facing
  tokenUsage: { input: number; output: number };
  latencyMs: number;
  cost: number;
}

interface RedactedSnapshot {
  schema: Record<string, PortType>;
  values: Record<string, unknown>;
  redactedFields: string[];
}

interface ExecutionTrace {
  id: string;
  spineId: string;
  startedAt: number;
  completedAt: number;
  path: ExecutionStep[];
  cost: number;
  totalTokens: number;
  success: boolean;
  failedAtCardId?: string;
}

interface ExecutionStep {
  cardId: string;
  startedAt: number;
  completedAt: number;
  latencyMs: number;
  tokens?: { input: number; output: number };
  cost?: number;
  inputSnapshot: RedactedSnapshot;
  outputSnapshot: RedactedSnapshot;
  evalResult?: EvalResult;
}

interface EvalResult {
  evalCardId: string;
  passed: boolean;
  score?: number;
  failureReason?: string;
}
```

---

## Key Architectural Decisions — Final Summary

### The Two Security Concepts

These must never be conflated in implementation:

| Concept         | What It Is                 | Where It Lives                  | Mechanism                                |
| --------------- | -------------------------- | ------------------------------- | ---------------------------------------- |
| Secret          | API key, credential, token | Secrets store → Vercel env vars | CardSecretReference — never in port flow |
| Sensitive field | User/customer data         | Port value, execution trace     | port.sensitive: true                     |

### Prompt Card vs Model Card Runtime Semantics

- **Prompt Card declares.** Does not execute. Defines template and expected output schema.
- **Model Card executes.** Runs LLM call. Validates output. Produces `ModelOutputPayload`.
- **Downstream cards consume Model Card output** — not Prompt Card output.
- Prompt Card output ports are visual/schema aliases only. They declare fields the connected Model Card must produce. At runtime, the connected Model Card exposes and transmits the actual values derived from that schema.

### Eval Execution

Fully async. Zero execution chain latency. Card A executes once. Eval observes output off-path. Card B receives output immediately. Results stream back asynchronously.

### PendingChange Queue on Return to Live

Queue is **preserved**. Returning to Live initializes the Live spine from the current SealedSnapshot, and PendingChange entries remain queued. Before Release, every queued entry must be validated and left `queued`, `rebased`, `included_in_release`, `rejected`, or `conflicted`. Conflicted changes block Release until resolved or rejected. Successful Release clears included entries atomically with the SealedSnapshot update; failed Release preserves the queue. User is shown count.

### Multi-Tab

Second tab is read-only in v1. No CRDT. No OT. Banner indicates primary session.

---

## Implementation Freeze Checklist

- [x] Source of truth — spine graph canonical, files derived, agent mutates spine only
- [x] Edit lifecycle — full state machine, Live and Sealed paths explicit and non-overlapping
- [x] LifecycleStage separated from CardState — independent subscriptions
- [x] Live / Seal / Sealed / Release — four distinct concepts, four distinct behaviors
- [x] Deployment model — Vercel via Spineless-managed API, one-time OAuth
- [x] Persistence model — all data types mapped to storage and retention windows
- [x] Eval execution — fully async, zero execution chain latency, fire-and-forget
- [x] Eval middleware — Card A executes once, no re-execution, no cost duplication
- [x] Structured output — Prompt declares, Model executes, downstream consumes Model output
- [x] Parser Card — removed from v1
- [x] rawResponse redaction — not persisted when any declared output field is sensitive unless schema-redacted before storage
- [x] Secret model — CardSecretReference, never PortType, never in port flow
- [x] Sensitive data — port.sensitive: boolean governs user data redaction in traces
- [x] Two security concepts clearly separated — secret vs sensitive field
- [x] System topology — component boundary diagram complete
- [x] Data contracts — all TypeScript interfaces defined and consolidated
- [x] Compilation pipeline — nine stages with failure behavior
- [x] Execution lifecycle — streaming, job-based, retry, timeout, error mapping
- [x] Secrets and sandboxing — entry, storage, Vercel push, never in source
- [x] Failure and recovery — compiler, deployment, provider, corruption all covered
- [x] Sealed-state editing — config allowed, structural blocked, becomes Gap Card
- [x] PendingChange queue — preserved on return to Live, rebase rules defined
- [x] PendingChange rebase — five explicit rules covering all structural drift scenarios
- [x] Navigation at scale — minimap, pinch overview, failure navigation, affected navigation
- [x] First-run affordances — inline empty state labels only, no wizard
- [x] Card creation gestures — port label affordance and drag-to-void, both canonical
- [x] Drag-to-void opens card picker — void drop does not cancel, picker does
- [x] Version locking — proposal binding, stale detection, multi-tab rule, server guard
- [x] Telemetry redaction — seven explicit rules
- [x] Gap Card severity — blocking, warning, instruction with distinct behaviors
- [x] Gap Card auto-resolution — teal pulse on source condition clearing
- [x] Per-card authoring spec — all nine card types fully specified
- [x] Confirmation state — full panel specification, what is and is not shown
- [x] Interaction behaviors — mouse, keyboard, undo/redo
- [x] Engineering acceptance criteria — measurable and testable

**The earlier Spineless v1 implementation contract was finalized before the document 11 scope reframe. That v1 implementation target is replaced by the application-flow scope until a new implementation canon is written; this document is historical context wherever it conflicts with document 11.**

---

_Spineless Contract Hardening. Version 2.1. May 2026._
_Document 11 supersedes this document wherever the application-flow reframe conflicts with earlier implementation details._
