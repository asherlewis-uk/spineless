# Spineless — Contract Hardening

**Version 2.0 | Source of Truth**

---

## Purpose

This document completes the implementation spec by resolving the eight contract hardening items identified in the final audit. Every resolution derives from locked context. This document is additive where it does not conflict with documents 08 and 09, and controlling where it does conflict with documents 08 or 09.

After this document, the doc set is implementation-freeze ready.

---

## Canonical Precedence

Documents 08, 09, and 10 define the Spineless v1 implementation canon.

If documents 00-07 conflict with documents 08-10, documents 08-10 control.

If document 10 conflicts with documents 08 or 09, document 10 controls.

Documents 00-07 remain product, visual, and scope context. They are not implementation-authoritative where superseded by documents 08-10.

Document 10 is a hardening and precedence layer. It supersedes conflicting implementation details in documents 08 and 09.

---

## 1. LifecycleStage Separated from CardState

The system now maintains two distinct type namespaces. These must never be conflated in implementation.

### SystemMode

The global operating mode of the spine.

```typescript
type SystemMode = "live" | "sealed";
```

### LifecycleStage

The current stage of the global edit/compile/deploy process. One active at a time, system-wide.

```typescript
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
```

### CardState

The visual and functional state of an individual card. Many cards can have different CardStates simultaneously.

```typescript
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
```

### Relationship Rule

`LifecycleStage` drives the global spine behavior and animation. `CardState` drives individual card visual rendering. They are related but independent:

- When `LifecycleStage` is `agent_invoked`, the triggering card's `CardState` remains `editing` until the proposal arrives, at which point it transitions to `confirming`
- When `LifecycleStage` is `compiling`, most cards remain in their current `CardState` — only the triggering card shows a subtle compile-in-progress pulse
- When `LifecycleStage` is `spine_settled`, each card independently resolves to its new `CardState` based on the mutation result

The renderer subscribes to both independently. UI components that render card surfaces subscribe to `CardState` only. Components that render global spine animation subscribe to `LifecycleStage` only.

---

## 2. PendingChange Rebase and Conflict Rules

### The Problem

A user queues a `PendingChange` in Sealed state, returns to Live, structurally modifies or deletes the affected card, then Seals again. The old `PendingChange` references a card or config path that no longer exists in its original form.

### Updated PendingChange Contract

```typescript
interface PendingChange {
  id: string;
  baseSnapshotId: string; // SealedSnapshot ID when change was queued
  targetCardId: string; // card the change targets
  targetConfigPath: string; // dot-notation path within CardConfig
  mutation: SpineMutation;
  userDescription: string;
  createdAt: number;
  status:
    | "queued" // waiting for Release
    | "rebased" // target changed but change safely remapped
    | "conflicted" // target deleted or structurally incompatible
    | "included_in_release" // applied in a Release
    | "rejected"; // user explicitly rejected
}
```

### Rebase Rules — Applied Before Every Release

Sealed edits create `PendingChange` entries only. They do not mutate the current `SealedSnapshot`, compile, or deploy. Before Release begins compilation, the system evaluates every `PendingChange` against the current `SealedSnapshot` spine graph:

**Rule 1 — Target card still exists, config path unchanged:**
Status remains `queued`. Change applies as authored. No user action required.

**Rule 2 — Target card still exists, config path changed due to schema evolution:**
System attempts automatic remap. If the semantic intent can be preserved (e.g., field renamed but same type), status becomes `rebased`. The user is shown: "[Card name] — this change was automatically updated to match your latest configuration." Rebased changes apply automatically on Release.

**Rule 3 — Target card deleted:**
Status becomes `conflicted`. A Gap Card surfaces at the position where the card existed, with the message: "A queued production change targeted a card that no longer exists. Review or dismiss." Release is blocked until all `conflicted` changes are resolved or rejected.

**Rule 4 — Target card structurally changed (ports altered, type changed):**
Status becomes `conflicted`. Same Gap Card behavior as Rule 3.

**Rule 5 — Target card present but change now redundant (current config already matches proposed):**
Status becomes `included_in_release` with a no-op flag. The change is recorded as applied but produces no mutation. No user action required.

### User-Visible Queue Management

The user can inspect and reject individual `PendingChange` entries from the Output Card face in Sealed state. Each queued change shows:

- Card name
- Plain-language description of the change
- Current status
- Reject action

Rejecting a change sets its status to `rejected` and removes it from the Release queue. The card's `pending` state clears.

The PendingChange queue is preserved on Return to Live. Successful Release clears included entries atomically with `SealedSnapshot` update. Failed Release preserves the queue.

---

## 3. Prompt Card and Model Card Execution Semantics

### The Clean Separation

**Prompt Card** is a declaration. It does not execute anything. It defines:

- The prompt template (text with variable bindings)
- The expected output schema (typed fields)

**Model Card** is the executor. It:

- Receives the compiled prompt from its connected Prompt Card
- Executes the LLM call
- Validates and structures the output against the Prompt Card's declared output schema
- Produces the actual runtime values

Downstream cards consume **Model Card output**, not Prompt Card output. The Prompt Card's output schema is a contract declaration — it defines what the Model Card's output will look like, not the output itself.

### Generated Type Contracts

```typescript
// Prompt Card declares — compile-time only
interface PromptDeclaration {
  template: string;
  variables: Record<string, PortType>; // input variable types
  declaredOutputSchema: Record<string, PortType>; // what Model Card must produce
}

// Edge payload from Prompt Card to Model Card — runtime
interface PromptToModelPayload {
  compiledPrompt: string; // template with variables resolved
  declaredOutputSchema: Record<string, PortType>;
}

// Model Card produces — runtime output
interface ModelOutputPayload {
  values: Record<string, unknown>; // typed against declaredOutputSchema
  rawResponse?: string; // not persisted if any declared output field is sensitive unless schema-redacted; never user-facing
  tokenUsage: { input: number; output: number };
  latencyMs: number;
  cost: number;
}
```

### What This Means for Port Wiring

The Prompt Card's output ports in the visual spine represent the **declared output schema fields**. They are displayed to make the system legible — the user can see what the connected Model Card must produce and wire those fields to downstream cards.

Prompt Card output ports are visual/schema aliases only. They are not independent runtime producers. At runtime, the connected Model Card exposes and transmits the actual values derived from the declared schema.

If the model produces output that does not match the declared schema, the Model Card enters `error` state. The mismatch is shown on the card face in plain language: "The model returned an unexpected format. Update the output schema or adjust the prompt."

---

## 4. Eval Execution Model — Fully Async (Option B)

### Decision

Eval evaluation is fully asynchronous. It runs completely off the execution path. Zero latency is added to the execution chain by Eval Cards.

### Correct Generated Pattern

```typescript
// Generated Eval middleware — fully async, zero execution latency
async function evalMiddleware_A_to_B(
  aOutput: AOutput,
  evalId: string,
): Promise<AOutput> {
  // Fire and forget — no await, no execution chain delay
  void evalEngine
    .evaluate({
      evalId,
      output: aOutput,
      timestamp: Date.now(),
    })
    .then((result) => evalEngine.stream(evalId, result))
    .catch(() => evalEngine.recordTelemetryGap(evalId));

  // Return immediately — Card B receives output without waiting for eval
  return aOutput;
}

// In the generated execution chain:
const aOutput = await cardA_execute(input);
const passthrough = await evalMiddleware_A_to_B(aOutput, "eval_uuid");
const bOutput = await cardB_execute(passthrough);
```

### Guarantees Under This Model

- Card A executes exactly once
- Card B receives output immediately after Card A completes — no eval latency
- Eval results arrive on the Eval Card face asynchronously, typically within 200-500ms of the execution step completing
- If the eval engine is unavailable, `recordTelemetryGap` fires and execution continues — the Eval Card shows a `telemetry_gap` indicator rather than a pass/fail result
- Eval results never retroactively affect an already-completed execution — they inform future suggestions only

### Eval Card Visual Behavior Under Async Model

- During execution: the Eval Card ribbon shows a subtle processing animation — distinct from pass/fail
- After eval result arrives (asynchronously): ribbon updates to pass (teal) or fail (red turbulence)
- If multiple executions complete before eval results arrive: results are applied to their corresponding ghost traces, not the current active state

---

## 5. Card Creation Gestures — Both

Two gestures serve different authoring moments. Both are canonical.

### Gesture A — Port Label Affordance (Guided)

For unconnected output ports, a subtle label renders directly on the port:

```
[output port] → Connect to a Prompt
[output port] → Connect to a Model
[output port] → Connect to a Logic
```

The label shows the most contextually appropriate downstream card type based on the current card type and port type.

**Clicking the label:**

1. The suggested card type materializes inline in the spine immediately below the current card
2. A connection forms automatically between the output port and the new card's input port
3. The new card enters `editing` state immediately — the user zooms in to configure it
4. The label disappears — the port is now connected

**When it appears:**

- Any unconnected output port in Live state
- Does not appear in Sealed state
- Does not appear on ports with type `any` where no suggestion is unambiguous

### Gesture B — Drag to Void (Experienced)

Dragging from any output port into empty spine space:

1. A drag trail follows the cursor — a thin ribbon of light extending from the port
2. Releasing on empty void opens an inline card picker at the drop point
3. The card picker shows only card types compatible with the dragged port's output type
4. Selecting a card type creates it at the drop point and connects it automatically
5. The new card enters `editing` state immediately

**Card Picker Appearance:**

- Floats at the drop point, dark surface, card type options as labeled tiles
- Maximum 6 options shown (all compatible types)
- Selecting dismisses the picker and materializes the card
- Pressing Escape or clicking void dismisses without creating

**When it appears:**

- Any output port drag in Live state
- Does not appear in Sealed state
- Available on all card types including Logic Card branch outputs

### First Card — Input Card Special Case

The spine opens with a single Input Card in unconfigured state. No port label appears on the Input Card's output port until the card is configured with at least one field. Once configured, the port label appears: "Connect to a Prompt →"

This prevents the user from wiring an unconfigured Input Card and producing a typed mismatch immediately.

---

## 6. Version Locking for Stale Proposals and Multi-Tab

### Proposal Version Binding

Every `SpineMutationProposal` is bound to the spine graph version that existed when the agent was invoked:

```typescript
interface SpineMutationProposal {
  triggeredBy: string;
  spineGraphVersion: number; // version at agent invocation time
  mutations: SpineMutation[];
  userDescription: string;
  downstreamEffects: string[];
}
```

### Stale Proposal Detection

At confirmation time, the system checks `proposal.spineGraphVersion` against `currentSpineGraph.version`.

If they differ — meaning the spine was mutated between agent invocation and user confirmation — the server rejects the proposal as stale:

- Card returns to the latest persisted confirmed state
- User sees on the card face: "This change is no longer valid — the system was updated while you were reviewing. Your edit was not lost — it will restart automatically."
- The edit that triggered the stale proposal re-enters `editing` state with the user's previous edit pre-populated
- The user can re-commit or discard

### Multi-Tab Rule

Spineless is a single-session product in v1. If the user opens Spineless in a second tab:

- The second tab renders the spine in read-only view mode
- A banner appears: "This spine is open in another window. Close that window to edit here."
- The second tab can scroll, zoom, and inspect but cannot edit
- If the first tab is closed, the second tab reloads and enters edit mode after a 3-second delay

This prevents concurrent spine mutations from different browser contexts without requiring complex CRDT or operational transform infrastructure in v1.

### Server-Side Version Guard

Every mutation request from the client includes the `clientSpineVersion` the client believes is current. The server rejects any mutation where the client version does not match the server's current version:

```typescript
interface MutationRequest {
  spineId: string;
  clientSpineVersion: number; // must match server's current version
  proposal: SpineMutationProposal;
}

// Server response on version mismatch:
interface MutationRejection {
  reason: "version_mismatch";
  serverVersion: number;
  latestSpineGraph: SpineGraph; // client rehydrates from this
}
```

On version mismatch rejection, the client rehydrates its local spine state from the server's latest and re-enters `editing` with the user's edit pre-populated.

---

## 7. Telemetry Redaction Rules

### What Is Stored

```typescript
interface ExecutionStep {
  cardId: string;
  startedAt: number;
  completedAt: number;
  latencyMs: number;
  tokens?: { input: number; output: number };
  cost?: number;
  inputSnapshot: RedactedSnapshot; // redacted input snapshot
  outputSnapshot: RedactedSnapshot; // redacted output snapshot
  evalResult?: EvalResult;
}

interface RedactedSnapshot {
  schema: Record<string, PortType>; // field names and types — always stored
  values: Record<string, unknown>; // actual values — stored per redaction rules
  redactedFields: string[]; // fields that were omitted from values
}
```

### Redaction Rules

**Rule 1 — Secrets are never stored.**
Secrets are credential references managed by the Secrets Store, not normal port values. Credential-reference detection and `port.sensitive === true` drive redaction. Secret values never appear in execution traces, ghost traces, Eval history, or any log.

**Rule 2 — Output Card destinations are always redacted.**
Output Card delivery payloads — the actual content sent to Slack, email, webhooks, or API responses — are stored as schema only. The delivered values are not stored. Delivery confirmation (success/failure, timestamp) is stored.

**Rule 3 — Sensitive field marking.**
Users can mark any field in an Input Card or Prompt Card output schema as sensitive. Sensitive fields are stored as `[REDACTED]` in traces. The field name is stored (for schema reference) but the value is not.

Marking a field sensitive is a config change — available in both Live and Sealed state.

**Rule 3a — rawResponse storage.**
`rawResponse` is not persisted when any declared output field is marked sensitive, unless the raw response is schema-redacted before storage. `rawResponse` is never shown in the user-facing UI.

**Rule 4 — Default storage.**
Default non-sensitive non-delivery values are stored for the rolling retention window (30 days for execution traces, 90 days for Eval results).

**Rule 5 — User-initiated deletion.**
The user can delete all execution traces for their spine at any time from the spine settings. Deletion permanently removes execution traces, Eval history, and ghost traces. Ghost traces clear from the renderer immediately.

**Rule 6 — Encryption.**
All stored `values` in `RedactedSnapshot` are encrypted at rest. The encryption key is per-user, not per-spine. Users do not manage keys directly.

### Data Model Addition

```typescript
interface Port {
  id: string;
  label: string;
  type: PortType;
  schema?: Record<string, PortType>;
  required: boolean;
  direction: "input" | "output";
  sensitive: boolean; // added — redacted in traces when true
}
```

---

## 8. Gap Card Severity

### Updated GapCardSpec

```typescript
type GapSeverity =
  | "blocking" // prevents compilation or Release — must be resolved
  | "warning" // system can proceed, but behavior may be degraded
  | "instruction"; // navigation or guidance — informs without blocking

interface GapCardSpec {
  insertAfterCardId: string;
  question: string; // plain language — what needs deciding
  context: string; // why the gap exists
  suggestedAction: string; // what the user should do
  severity: GapSeverity;
  deferrable: boolean; // can the user dismiss without resolving?
  source: // what created this Gap Card
    | "compiler_failure"
    | "analysis_timeout"
    | "structural_change_in_sealed"
    | "agent_unresolvable"
    | "pending_change_conflict"
    | "deferred_design_decision";
}
```

### Severity Behavior Rules

**Blocking:**

- Compilation cannot proceed while a blocking Gap Card exists
- Release cannot proceed while a blocking Gap Card exists
- The Gap Card cannot be deferred — `deferrable: false` always
- Visual: full unstable violet-white flicker, ribbon connections entering/exiting are severed visually
- Examples: compiler TypeScript error, pending change conflict, analysis timeout on critical path

**Warning:**

- Compilation and Release proceed despite the gap
- Execution proceeds but may be degraded (e.g., missing memory store, optional tool unavailable)
- The Gap Card can be deferred — `deferrable: true`
- Visual: amber pulse, muted compared to blocking — present but not alarming
- Examples: memory store unavailable, optional tool credentials missing, eval baseline not yet established

**Instruction:**

- Purely navigational — tells the user what to do next, does not represent a system failure
- Always deferrable
- Automatically dismissed when the user takes the suggested action
- Visual: soft neutral glow, no flicker — reads as guidance not as a problem
- Examples: structural change attempted in Sealed state ("Return to Live to continue"), first-run affordance for unconnected output ports

### Gap Card Resolution Tracking

```typescript
interface GapCard extends Card {
  type: "gap";
  spec: GapCardSpec;
  resolvedAt?: number;
  resolvedBy?: "user_action" | "deferred" | "auto_resolved";
}
```

Auto-resolution occurs when the system detects that the gap's source condition no longer exists — for example, a user connects a missing card, making an instruction Gap Card no longer relevant. Auto-resolved Gap Cards dissolve with a brief teal pulse — confirmation that the system recognized the resolution.

---

## Implementation Freeze Checklist

The following confirms every major contract ambiguity is now resolved:

- [x] Source of truth — spine graph canonical, files derived
- [x] Edit lifecycle — full state machine, Live and Sealed paths explicit
- [x] LifecycleStage separated from CardState
- [x] Live / Seal / Sealed / Release — four distinct concepts, no overlap
- [x] Deployment model — Vercel via Spineless-managed API
- [x] Persistence model — all data types mapped to storage and retention
- [x] Eval Card runtime — fully async, zero execution latency
- [x] Structured output — Prompt declares, Model executes, downstream consumes Model output
- [x] Parser Card — removed from v1
- [x] System topology — component boundary diagram complete
- [x] Data contracts — core TypeScript interfaces defined
- [x] Compilation pipeline — nine stages with failure behavior
- [x] Execution lifecycle — streaming, job-based, retry, timeout, error mapping
- [x] Secrets and sandboxing — entry, storage, Vercel push, never in source
- [x] Failure and recovery — compiler, deployment, provider, corruption all covered
- [x] Sealed-state editing — config allowed, structural blocked
- [x] PendingChange queue — preserved on return to Live, rebase rules defined
- [x] Navigation at scale — minimap, pinch overview, failure navigation, affected card navigation
- [x] First-run affordances — inline empty state labels only, no wizard
- [x] Card creation gestures — port label affordance and drag-to-void, both canonical
- [x] Version locking — proposal binding, stale detection, multi-tab rule, server guard
- [x] Telemetry redaction — secrets, Output Card delivery, sensitive fields, user deletion
- [x] Gap Card severity — blocking, warning, instruction with distinct behaviors
- [x] Per-card authoring spec — all nine card types fully specified
- [x] Confirmation state — full panel specification, what is and is not shown
- [x] Interaction behaviors — mouse, keyboard, undo/redo
- [x] Engineering acceptance criteria — measurable, testable

---

_Spineless Contract Hardening. Version 1.0. April 2026._
_This document completes the Spineless v1 documentation set._
