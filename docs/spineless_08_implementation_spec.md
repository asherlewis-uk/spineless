# Spineless — Implementation State & Interaction Spec

**Version 2.0 | Source of Truth**

---

## 1. State Machine — Complete

### Live State Edit Path

See Architecture Contract (07), Section 2. Canonical reference.

### Sealed State Edit Path

See Architecture Contract (07), Section 2. Canonical reference.

### Release Path

See Architecture Contract (07), Section 2. Canonical reference.

### Return to Live Path

See Architecture Contract (07), Section 2. Canonical reference.

---

## 2. Type System

See documents 09 and 10 for the consolidated implementation contracts. Key types for this document:

```typescript
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

**Critical distinction:** `LifecycleStage` is the single global process state — one active at a time, system-wide. `CardState` is the visual and functional state of an individual card — many cards can have different `CardState` values simultaneously. The renderer subscribes to both independently. UI components rendering card surfaces subscribe to `CardState` only. Components rendering global spine animation subscribe to `LifecycleStage` only.

### CardState Transition Rules

These are per-card visual/functional states only. Global edit, compile, queue, and release progress uses `LifecycleStage`, not `CardState`.

| From             | To               | Trigger                                                   |
| ---------------- | ---------------- | --------------------------------------------------------- |
| idle             | editing          | user focuses card                                         |
| editing          | analysis         | user commits edit                                         |
| analysis         | confirming       | agent returns proposal for triggering card                |
| analysis         | affected         | upstream edit affects this card                           |
| analysis         | idle             | impact analysis completes with no card-level visual issue |
| confirming       | idle             | user rejects proposal                                     |
| confirming       | idle (with gap)  | user confirms, compilation fails                          |
| confirming       | pending          | user confirms, system is Sealed                           |
| confirming       | idle             | user confirms, Live, compilation succeeds                 |
| error            | idle             | user acknowledges error                                   |
| sealed_error     | sealed           | user retries or dismisses                                 |
| affected         | idle             | upstream resolution applied                               |
| affected         | needs_resolution | user rejects suggested resolution                         |
| needs_resolution | confirming       | user manually resolves and agent returns proposal         |
| pending          | idle             | Release clears queue                                      |
| unresolved       | idle             | user resolves or defers Gap Card                          |

---

## 3. MutationScope Enforcement

```typescript
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
```

When the system is in Sealed state, the agent validates every mutation before returning a proposal. Any mutation with `allowedIn: 'live_only'` becomes a `GapCardSpec` instead, with the message: "This change requires structural editing. Return to Live to continue."

---

## 4. Impact Analysis Budget

- **Target:** <100ms for spines ≤50 cards
- **Progressive:** For spines >50 cards or analysis exceeding 100ms, results stream as each subgraph resolves. Affected cards pulse as their results arrive. Triggering card enters `analysis` state immediately.
- **Hard timeout:** 5 seconds. All unanalyzed cards marked `affected`. Gap Card surfaces at triggering edit. Analysis never blocks viewing or scrolling.

---

## 5. Eval Middleware

Fully async. Zero execution chain latency. See Architecture Contract (07), Section 6 for canonical pattern.

The key guarantee: Card A executes exactly once. The eval middleware observes Card A's already-produced output. Card B receives output immediately. Eval results stream back asynchronously — typically 200-500ms after the execution step. If eval engine unavailable, execution continues and a telemetry gap is recorded.

---

## 6. PendingChange Rebase Rules

Applied before every Release. Full contract in Architecture Contract (07), Section 9.

Sealed edits create `PendingChange` entries only. They do not mutate `SealedSnapshot`, compile, or deploy. Release validates the queue before compilation.

**Rule 1 — Target exists and path unchanged:** Status remains `queued`. Change applies as authored.
**Rule 2 — Target exists and path can be semantically remapped:** Status → `rebased`. Applies automatically. User shown plain-language note.
**Rule 3 — Target deleted:** Status → `conflicted`. Gap Card surfaces. Release blocked until resolved or rejected.
**Rule 4 — Target structurally incompatible:** Status → `conflicted`. Same as Rule 3.
**Rule 5 — Current config already matches proposed change:** Status → `included_in_release` as a no-op. No user action required.

Conflicted changes block Release until resolved or rejected. The PendingChange queue is preserved on Return to Live. Successful Release clears included entries atomically with `SealedSnapshot` update. Failed Release preserves the queue.

User can inspect and reject individual PendingChange entries from the Output Card face in Sealed state.

---

## 7. Version Locking

Every `SpineMutationProposal` is bound to `spineGraphVersion` at agent invocation time. At confirmation, if versions differ, the proposal is rejected as stale. The card returns to its latest persisted confirmed state. The edit re-enters `editing` with the user's previous edit pre-populated. User is shown: "This change is no longer valid — the system was updated while you were reviewing. Your edit was not lost — it will restart automatically."

**Multi-tab rule:** Spineless is single-session in v1. A second tab renders the spine read-only with banner: "This spine is open in another window. Close that window to edit here." Second tab can scroll, zoom, inspect — cannot edit.

**Server-side guard:** Every mutation request includes `clientSpineVersion`. Server rejects mutations where client version differs from server current version. On rejection, client rehydrates from server's latest spine graph and re-enters editing with edit pre-populated.

---

## 8. Per-Card Authoring Specification

### Prompt Card

**Empty state:** "What should this prompt do?"

**Required:** Prompt text (min 1 char), at least one output schema field.

**Optional:** System prompt (collapsed by default), additional output schema fields.

**Port creation:** Input ports created when `{variable}` syntax used in prompt text — variable name becomes port label, type defaults to `text`. Output ports created through output schema builder — each field becomes a declared output port.

**Validation:**

- Empty text → empty state label shown, port cannot connect
- Text present, no output schema → amber: "Define what this prompt returns"
- Text and schema present → fully configured

**Confirmation panel shows:**

- Before: first 80 characters of previous prompt text
- After: first 80 characters of new prompt text
- Change summary: agent-generated plain-language description

**Sealed-state:** Prompt text editable (config). Output schema fields NOT editable (structural). System prompt editable (config).

---

### Model Card

**Empty state:** "Which model handles this?"

**Required:** Model selection.

**Optional:** Temperature (0–2, default 1.0), max tokens, retry count (default 2), timeout seconds (default 30), JSON mode (auto-enables when Prompt Card has output schema).

**Port creation:** Single input port created automatically. Single output port derived from connected Prompt Card's declared output schema.

**Validation:**

- No model selected → empty state label
- Model selected, no API key → secrets panel surfaces inline: "This model needs an API key"
- Model selected, API key present → configured, cost-per-run visible

**Sealed-state:** Model selection NOT editable (structural). Temperature, max tokens, retry count, timeout editable (config). JSON mode NOT editable (structural).

---

### Tool Card

**Empty state:** "What can this agent do?"

**Required:** Tool name, at least one input port, at least one output port, execution target (API endpoint URL or built-in tool).

**Optional:** Input port descriptions, timeout override.

**Port creation:** Input and output ports created manually through port builder on card face.

**Validation:**

- No name or execution target → empty state label
- Name and target, no ports → amber: "Define what this tool accepts and returns"
- Fully configured → shows tool name and port count

**Sealed-state:** Execution target URL editable (config). Port definitions NOT editable (structural). Tool name NOT editable (structural).

---

### Memory Card

**Empty state:** "How does this system remember?"

**Required:** Retention strategy selection.

**Optional:** Retention window, external store connection.

**Port creation:** Single input port (accepts upstream output). Single output port typed to match retention strategy.

**Validation:**

- No strategy → empty state label
- Strategy selected, external store required but not connected → secrets panel: "Connect a store"
- Fully configured → shows strategy name and fill level indicator

**Sealed-state:** Retention window editable (config). Strategy type NOT editable (structural). External store connection NOT editable (structural).

---

### Logic Card

**Empty state:** "When should this branch?"

**Required:** At least one condition defined, at least two output connections.

**Optional:** Default branch designation.

**Port creation:** Single input port. One output port per defined branch, labeled with condition summary.

**Validation:**

- No condition → empty state label
- Condition references variable not in upstream schema → red: "Variable not found: {name}"
- Valid condition, fewer than two output connections → amber: "Connect at least two branches"
- Fully configured → shows condition summary

**Sealed-state:** Condition values editable (config — e.g., threshold numbers). Condition variable references NOT editable (structural). Branch count NOT editable (structural).

---

### Input Card

**Empty state:** "What enters your system?"

**Required:** At least one input field with name and type.

**Optional:** Field validation rules, input delivery method (API / webhook / form — default API).

**Port creation:** One output port per defined input field, typed to match field type. Port label "Connect to a Prompt →" appears once at least one field is configured.

**Special case:** Port label does not appear until at least one field is configured. Prevents wiring an unconfigured Input Card and producing immediate type mismatch.

**Sealed-state:** Validation rules editable (config). Field names and types NOT editable (structural). Delivery method NOT editable (structural).

---

### Output Card

**Empty state:** "Where does this go?"

**Required:** Delivery destination, format selection.

**Optional:** Response schema validation (for API response), destination-specific config (channel for Slack, address for email).

**Port creation:** Single input port. No output ports — Output Card is a terminal node.

**Validation:**

- No destination → empty state label
- Destination selected, credentials required but absent → secrets panel surfaces inline
- Fully configured → shows destination and format

**Sealed-state:** Format editable (config). Destination type NOT editable (structural). Destination-specific config (channel, address) editable (config).

---

### Eval Card

**Empty state:** "What does good look like here?"

**Required:** At least one example input/output pair.

**Optional:** Assertion rules, pass threshold (default 80%), drift alert threshold.

**Port creation:** No traditional ports. Eval Cards wrap a connection, not a card. Types inherited from the wrapped connection.

**Validation:**

- No examples → empty state label
- Examples present → shows example count and current pass rate

**Sealed-state:** Examples editable — adding is config change. Pass threshold editable (config). Drift alert threshold editable (config). Assertion rules editable (config). Removing examples below minimum (1) not allowed.

---

### Gap Card

No empty state label — system-generated only.

**System-generated fields:** Question (what needs deciding), context (why), suggested action (what to do).

**Resolution:** User adds required card/connection, or explicitly defers with "Defer" action (gap persists with reduced visual weight).

**Sealed-state:** Config-level Gap Cards resolvable. Structural Gap Cards show: "Return to Live to resolve this."

**Auto-resolution:** When source condition no longer exists, Gap Card dissolves with brief teal pulse.

---

## 9. Confirmation State Specification

### Card Visual

**Back layer (current):** Card surface dims to 40% opacity. Current configuration visible but grayed.

**Front layer (proposed):** Full opacity. Proposed configuration rendered. Changed elements with subtle amber outline.

### Confirmation Panel

```
─────────────────────────────────────────
[Change summary — plain language, 1-2 sentences]

Also affects:
• [Card name] — [plain language effect]
• [Card name] — [plain language effect]

[ Confirm ]    [ Reject ]
─────────────────────────────────────────
```

**Never shown:** File names, paths, generated code, TypeScript types, compilation details, compilation logs, Vercel details, deployment details, raw provider errors, raw error messages.

**Multi-card proposals:** All affected cards listed in "Also affects". User confirms or rejects entire proposal — no partial acceptance in v1.

**Stale proposal:** Every `SpineMutationProposal` includes `spineGraphVersion`. Every mutation request includes `clientSpineVersion`. Confirmation checks `proposal.spineGraphVersion` against `currentSpineGraph.version`, and the server rejects stale mutations on version mismatch. On stale proposal rejection, the card returns to the latest persisted confirmed state, the user sees that the change is no longer valid because the system updated, and the user's edit re-enters `editing` state pre-populated. The user can recommit or discard.

**Rejection:** Explicit user rejection discards the unconfirmed edit and leaves the spine at its latest persisted confirmed state. No spine mutation. No compilation. Ghost trace does not emit. Impact analysis results clear. System returns to `idle`.

---

## 10. Telemetry Redaction Rules

> **Rule numbering:** Doc 10 §7 is the controlling numbering scheme and supersedes the rule order below. The semantic content is identical; the numbers differ. Implement from doc 10 §7.

**Rule 1 — Secrets never stored:** Secret values do not flow through ports and cannot appear in traces. `CardSecretReference` manages secrets outside normal port flow.

**Rule 2 — rawResponse redaction:** `rawResponse` is not persisted when any declared output field is marked sensitive, unless the raw response is schema-redacted before storage. `rawResponse` is never shown in the user-facing UI. If no declared output fields are sensitive, `rawResponse` may be stored for the retention window. `rawResponse` is excluded from Eval Card inputs — Eval Cards receive Model Card structured values only.

**Rule 3 — Output Card delivery:** Delivery payloads (content sent to Slack, email, webhooks, API responses) stored as schema only — not values. Delivery confirmation (success/failure, timestamp) stored.

**Rule 4 — Sensitive field marking:** Users can mark any field in Input Card or Prompt Card output schema as `sensitive: true`. Sensitive fields stored as `[REDACTED]` in traces. Field name stored (for schema reference), value not stored. Marking a field sensitive is a config change — available in both Live and Sealed state.

**Rule 5 — Default storage:** Default non-sensitive values are stored for the rolling retention window.

**Rule 6 — User-initiated deletion:** User can delete all execution traces at any time. Deletion permanently removes execution traces, Eval history, and ghost traces. Ghost traces clear from the renderer immediately.

**Rule 7 — Encryption:** All stored `values` in `RedactedSnapshot` encrypted at rest. Per-user encryption key. Users do not manage keys directly.

---

## 11. Gap Card Severity Behavior

| Severity    | Compilation    | Release        | Deferrable          | Visual                                                  |
| ----------- | -------------- | -------------- | ------------------- | ------------------------------------------------------- |
| Blocking    | Cannot proceed | Cannot proceed | No                  | Full violet-white flicker, connections severed visually |
| Warning     | Proceeds       | Proceeds       | Yes                 | Amber pulse, present but not alarming                   |
| Instruction | Proceeds       | Proceeds       | Yes, auto-dismisses | Soft neutral guidance glow                              |

---

## 12. Card Creation Gestures

### Gesture A — Port Label Affordance (Guided)

Unconnected output ports show a subtle label: "Connect to a [suggested type] →". Clicking creates the suggested card type inline immediately below the current card, connects automatically, new card enters `editing` state.

**Appears:** Any unconnected output port in Live state. Not in Sealed state. Not on `any` type ports where no suggestion is unambiguous.

**First card special case:** Input Card port label does not appear until at least one field is configured.

### Gesture B — Drag to Void (Experienced)

Dragging from any output port into empty spine space trails a ribbon of light from the port. Releasing on void opens an inline card picker at the drop point showing only compatible downstream card types. Selecting creates the card at the drop point and connects automatically. New card enters `editing` state.

**Picker dismissal:** Pressing Escape or clicking void while picker is open cancels creation — no card created.

**Appears:** Any output port drag in Live state. Not in Sealed state. Available on all card types including Logic Card branch outputs.

---

## 13. Minimap Specification

**Appearance:** Fixed 12px wide element at right edge of viewport. Full viewport height. No border, no background — floating over the void.

**Segments:** Each card is a colored segment proportional to its scroll height. Idle cards use card type colors. Non-idle cards use state colors.

**Interaction:** Clicking any segment snaps scroll to that card. Hovering shows tooltip: "[Card Type] — [card name or first line of config]". Current viewport position shown as subtle white bracket overlay.

---

## 14. Engineering Acceptance Criteria

### Edit Lifecycle

- [ ] Card edit commits trigger impact analysis within 16ms of commit event
- [ ] Impact analysis completes in <100ms for spines ≤50 cards
- [ ] Impact analysis streams progressively for spines >50 cards
- [ ] Affected cards pulse within 16ms of their individual analysis result arriving
- [ ] Agent invoked only after user resolves or dismisses all suggestions
- [ ] Agent invocation never blocks the UI thread
- [ ] Confirmation panel surfaces within 500ms of agent returning proposal
- [ ] Spine mutation and compilation complete within 2 seconds of confirmation for spines ≤50 cards
- [ ] Compilation failure rolls back spine mutation atomically
- [ ] Gap Card surfaces within 16ms of compilation failure detection

### Sealed State

- [ ] Structural card controls visually locked and non-interactive in Sealed state
- [ ] Config card controls remain interactive in Sealed state
- [ ] Confirmed Sealed edits create PendingChange entries, never mutate SealedSnapshot
- [ ] No compilation or deployment on Sealed confirmational changes
- [ ] Pending indicator appears within 16ms of PendingChange creation
- [ ] Structural mutation proposals in Sealed state converted to Gap Cards by agent

### PendingChange Queue

- [ ] Queue preserved when returning to Live state
- [ ] Queue indicator visible in Live state when pending changes exist
- [ ] Release validates queue before attempting compilation
- [ ] Release compilation failure preserves queue in full
- [ ] Successful Release clears queue atomically with snapshot update
- [ ] User shown count: "X queued production changes will apply on your next release"

### Eval Cards

- [ ] Eval middleware executes Card A exactly once per execution job
- [ ] evalEngine stream is fire-and-forget — never blocks execution chain
- [ ] Eval infrastructure unavailability does not block execution
- [ ] Eval results stream to client within 500ms of each execution step completing
- [ ] Pass rate visible on Eval Card face updates after every execution
- [ ] Drift detection runs on rolling window, amber state triggers at configured threshold

### Deployment

- [ ] Seal triggers Vercel deployment via API, not manual user action
- [ ] Production URL surfaces on Output Card within 30 seconds of Seal confirmation
- [ ] Vercel failure surfaces sealed_error on Output Card, never raw API error
- [ ] sealed_error state includes retry action on Output Card face
- [ ] Secrets pushed to Vercel as environment variables, never embedded in source

### Ghost Traces

- [ ] Ghost trace renders within 500ms of execution job completion
- [ ] Ghost traces fade linearly over 30 seconds of display time
- [ ] Maximum 10 ghost traces rendered simultaneously per connection
- [ ] Failed execution ghost traces render in red turbulence color
- [ ] Ghost traces removed when older than 30 days

### Version Locking

- [ ] Every SpineMutationProposal bound to spineGraphVersion at invocation
- [ ] Stale proposals rejected at confirmation time if version differs
- [ ] User's edit pre-populated on stale rejection — not discarded
- [ ] Second tab renders read-only with banner
- [ ] Server rejects mutations with mismatched clientSpineVersion
- [ ] Client rehydrates spine and re-populates edit on server rejection

---

## 15. Interaction Behaviors

### Card Interactions

| Interaction                   | Behavior                                                  |
| ----------------------------- | --------------------------------------------------------- |
| Click card (idle)             | Zooms spine to card, surface magnifies for editing        |
| Click void (zoomed)           | Zooms back out to spine view                              |
| Scroll (spine view)           | Moves camera through spine depth                          |
| Pinch out (trackpad)          | Zooms to full overview                                    |
| Pinch in (overview)           | Zooms back to spine view at pinch center                  |
| Click card (overview)         | Snaps to card at full zoom                                |
| Right-click connection        | Radial: Wrap with Eval / Remove                           |
| Drag from output port         | Initiates connection — compatible input ports highlighted |
| Drop on compatible input port | Creates connection if types match                         |
| Drop on void                  | Opens compatible card picker at drop point                |
| Escape while picker open      | Cancels — no card created                                 |
| Click void while picker open  | Cancels — no card created                                 |
| Escape (editing)              | Discards edit, returns to idle                            |
| Enter (editing)               | Commits edit (single-line fields)                         |
| Cmd+Enter (editing)           | Commits edit (multi-line fields)                          |
| Escape (confirming)           | Rejects proposal                                          |
| Enter (confirming)            | Confirms proposal                                         |
| Click port label              | Creates suggested card type, connects automatically       |

### Keyboard Shortcuts

| Shortcut    | Action                                       |
| ----------- | -------------------------------------------- |
| Space       | Toggle between spine view and full overview  |
| Escape      | Zoom out one level                           |
| Cmd+Z       | Undo last confirmed change (Live state only) |
| Cmd+Shift+Z | Redo (Live state only)                       |

### Undo / Redo

Operates on confirmed spine mutations — not in-progress edits. Each undo reverts the spine graph to the previous versioned state and recompiles. Available in Live state only. Not available in Sealed state — use PendingChange queue to correct Sealed edits.

---

_Spineless Implementation State & Interaction Spec. Version 2.0. April 2026._
