# Spineless — Copilot Instructions

## What This Repository Is

This is a **design specification repository** for Spineless v1. There is no application code yet — only `docs/`. The docs are the source of truth for all implementation decisions. When implementation begins, all architectural choices derive from these documents.

---

## Document Precedence

**This rule is load-bearing.** When documents conflict, the higher-numbered document controls:

- Documents 08–10 are the implementation canon. They supersede 00–07 on any conflicting detail.
- Document 10 supersedes documents 08 and 09 wherever they conflict.
- Documents 00–07 remain product, visual, and scope *context* only — they are not implementation-authoritative where superseded by 08–10. This includes visual language: if docs 08–10 resolve a visual detail differently from doc 03, docs 08–10 control.

When answering questions or generating implementation code, always resolve conflicts in favor of the higher-numbered document.

---

## What Spineless Is (System Mental Model)

Spineless is a **visual, scroll-based environment** for building full-stack AI systems without writing code. Key mental model:

- **The spine graph is the single source of truth.** Generated Next.js/TypeScript files are derived artifacts, never canonical state.
- **The agent mutates spine state only.** It never mutates source files directly. The compiler deterministically generates source from spine state.
- **Cards are the atomic unit.** Every card corresponds to a real functional system component in the compiled output.
- **Two system modes:** `live` (editable, continuous compilation) and `sealed` (production-locked, changes queue as `PendingChange`).
- **Autonomous reasoning, confirmed writing.** The agent proposes `SpineMutationProposal`; the user confirms before any spine mutation occurs.

---

## Canonical Type System

The authoritative types are in `docs/spineless_09_contract_hardening.md` (consolidated) and superseded by `docs/spineless_10_contract_hardening.md` where they conflict. Key distinctions:

### `LifecycleStage` vs `CardState` — never conflate these

```typescript
// Global process state — one active at a time, system-wide
type LifecycleStage =
  | 'idle' | 'editing' | 'impact_analysis' | 'suggestions_visible'
  | 'agent_invoked' | 'confirming' | 'spine_mutating' | 'compiling'
  | 'live_runtime_updating' | 'pending_change_queued'
  | 'release_validating' | 'release_compiling'
  | 'release_deploying' | 'snapshot_updating' | 'spine_settled';

// Per-card visual/functional state — many cards have different states simultaneously
type CardState =
  | 'idle' | 'editing' | 'active' | 'passing' | 'error' | 'sealed_error'
  | 'affected' | 'needs_resolution' | 'confirming' | 'sealed'
  | 'unresolved' | 'pending' | 'analysis';
```

The renderer subscribes to both independently. UI components rendering card surfaces subscribe to `CardState` only. Components rendering global spine animation subscribe to `LifecycleStage` only.

> **`'editing'` name collision:** The string `'editing'` is a valid value in *both* `LifecycleStage` and `CardState`. They are entirely separate namespaces with independent subscribers. Example: when `LifecycleStage` is `'agent_invoked'`, the triggering card's `CardState` is still `'editing'` until the proposal arrives and transitions it to `'confirming'`. Never infer one type's state from the other's value.

### The Two Security Concepts — never conflate these

| Concept | What | Mechanism |
|---------|------|-----------|
| Secret | API key, credential, token | `CardSecretReference` — **never flows through ports** |
| Sensitive field | User/customer data | `port.sensitive: true` — redacted in execution traces |

`'secret'` is **not** a `PortType`. Secrets never enter port flow.

### Nine Card Types

`'input' | 'prompt' | 'model' | 'tool' | 'memory' | 'logic' | 'output' | 'eval' | 'gap'`

**Parser Card does not exist in v1.** Structured output is handled by Prompt Card declared schema + Model Card enforcement.

---

## Critical Architectural Rules

### Prompt Card vs Model Card semantics
- **Prompt Card declares.** Does not execute. Defines template and expected output schema.
- **Model Card executes.** Runs LLM call, validates output, produces `ModelOutputPayload`.
- **Downstream cards consume Model Card output** — not Prompt Card output. Prompt Card output ports are visual/schema aliases only.
- `rawResponse` on `ModelOutputPayload` is **never shown in any user-facing UI**, regardless of sensitivity. It is for internal tracing only and is subject to the redaction rules in the Telemetry section below.

### Eval Card execution
Eval Cards compile to fully async middleware. They **never block execution** and **never re-execute Card A**:
```typescript
async function evalMiddleware(aOutput: AOutput, evalId: string): Promise<AOutput> {
  void evalEngine
    .evaluate({ evalId, output: aOutput, timestamp: Date.now() })
    .then(result => evalEngine.stream(evalId, result))
    .catch(() => evalEngine.recordTelemetryGap(evalId));
  return aOutput; // Card B receives output immediately — zero eval latency
}
```

### `MutationScope` enforcement
In Sealed state, mutations with `allowedIn: 'live_only'` become `GapCardSpec` instead of proposals. The message is: `"This change requires structural editing. Return to Live to continue."` These Gap Cards have severity `instruction` — they are deferrable and auto-dismiss when the user returns to Live.

Structural mutations (`update_ports`, `update_output_schema`, `add_card`, `remove_card`, `add_connection`, `remove_connection`) are `live_only`. Config mutations (`update_config`, `resolve_gap`, `rotate_secret`) are allowed in both states.

### Version locking
Every `SpineMutationProposal` binds to `spineGraphVersion` at agent invocation. If versions differ at confirmation, the server returns `MutationRejection` with `latestSpineGraph`. The client rehydrates its local spine state from that payload and re-enters `editing` with the user's previous edit pre-populated. The user sees on the card face: *"This change is no longer valid — the system was updated while you were reviewing. Your edit was not lost — it will restart automatically."*

**Multi-tab:** Second tab renders the spine read-only with banner: `"This spine is open in another window. Close that window to edit here."` The second tab can scroll, zoom, and inspect but cannot edit. If the primary tab is closed, the second tab reloads and enters edit mode after a **3-second delay**.

### Gap Cards
Gap Cards are **system-generated, never user-created**. Blocking gaps prevent compilation and Release. Warning/instruction gaps are deferrable. Auto-resolved gaps dissolve with a teal pulse when their source condition clears.

---

## System Topology

```
Browser: WebGL Spine Renderer + React Card Interaction Layer (HTML overlay on WebGL)
    ↕ WebSocket + REST
Server: Spine Graph Store, Impact Analysis Engine, Agent Runtime, Compiler,
        Live Runtime Sandbox, Telemetry Store, Eval Engine, Secrets Store,
        Sealed Release Manager (SealedSnapshot + PendingChange queue)
    ↕ Vercel API
Vercel: Generated Next.js deployments (production runtime)
```

---

## Spatial Grammar

The spine uses **scroll-driven vertical depth** as its primary spatial logic. This governs the WebGL renderer layout entirely.

- **Scroll position = execution depth.** Further down the spine = later in the execution chain. Data flows downward.
- **Branching = parallel depth tracks.** When a Logic Card branches, both paths continue downward side by side, rejoining at a merge point. The spine never widens — parallel tracks are the only horizontal expansion.
- **Z-depth = abstraction level.** Entry points sit closest to the viewer; deep chain elements recede slightly. Creates natural parallax as the user scrolls.
- **Zoom = inspection level.** Scrolling moves the camera through the system. Zooming into a card magnifies its surface for direct interaction. Zooming out reveals the full system.
- **Complexity is managed through depth, not sprawl.** When a system grows complex, it scrolls deeper. It does not widen.

The spine is not a canvas. Cards are not dragged onto a 2D surface. The spine arranges itself in execution order based on the connections the user authors.

---

## Compilation Pipeline (9 stages)

`VALIDATE_GRAPH` → `RESOLVE_EXECUTION_ORDER` → `INFER_SCHEMAS` → `GENERATE_COMPILATION_PLAN` → `GENERATE_SOURCE_ARTIFACTS` → `TYPECHECK` → `UPDATE_RUNTIME` → `PERSIST_SNAPSHOT` → `SURFACE_RESULT`

**Stage 1 (VALIDATE_GRAPH) failure:** Surfaces Gap Cards at the invalid connection or card and aborts. No rollback — no spine mutation has occurred yet.

**Stage 6 (TYPECHECK) failure:** Rolls back the spine mutation atomically and surfaces a Gap Card at the responsible card.

---

## Visual Language

### Color Temperature Encoding
This encoding is **immutable**. These colors mean these states everywhere in Spineless, always.

| Temperature | Hex Range | State |
|-------------|-----------|-------|
| Warm amber-orange | `#BA7517` → `#EF9F27` | Active, processing |
| Deep teal-green | `#0F6E56` → `#1D9E75` | Healthy, passing |
| Soft neutral white-blue | `#B5D4F4` → `#E6F1FB` | Idle |
| Cold blue-white crystalline | `#85B7EB` → `#E6F1FB` | Sealed |
| Red turbulence | `#A32D2D` → `#E24B4A` | Error, failing |
| Amber cascade | `#BA7517` → `#FAC775` | Affected, warning |
| Unstable violet-white | `#7F77DD` → `#EEEDFE` | Unresolved, Gap |
| Transparent white fading | — | Ghost traces (passing/neutral) |

### Material Language
- All surfaces are **glassmorphic** — translucent, physically thick, light refracting through edges. Cards exist at genuine z-depth, not as flat 2D elements.
- Card edges carry a subtle glitch quality — reality flickering at the boundary. Most pronounced on Gap Cards and during `confirming` state.
- Frost and crystalline textures appear **only** in Sealed state.
- All light is emitted **from within UI elements**. No external light sources. The void is lit entirely by the system itself.

### The Void
Near-black environment with subtle organic ambient drift — breathing, not static. Biomechanical undertones. The void **never has** floors, walls, ceilings, external light sources, smoke, fog, atmospheric haze, or UI chrome.

### Live vs Sealed Visual Shift
- **Live:** Warm/neutral inner light, particle streams flowing, executing cards flare amber, ghost traces fading.
- **Sealed → crystallization wave** travels down the spine from Input Card to Output Card: glass becomes ice, particle streams slow to near stillness, ribbons become rigid and bright. Cold blue-white with frost at card edges.
- **Return to Live:** Cold-to-warm visual reversal, crystallization dissolves.

### Execution Animation Sequence
1. Input Card flares white — particle streams surge downward
2. Each card activates sequentially as data arrives
3. Model Card glows amber, pulses with latency heat while waiting for LLM response — particle streams slow through it
4. Response arrives — particles accelerate through downstream cards
5. Logic Card evaluates — one branch brightens, the other dims
6. Output Card receives result — surfaces on the card face
7. Execution ghost begins fading — transparent echo settles into spine memory

### Ribbon Connections
- Width encodes relationship strength — primary data flow is wide, conditional/secondary is narrower.
- Particle streams travel **downward** along ribbons in the direction of data flow.
- Ribbons through Eval Cards change character — green luminescence when passing, red turbulence when failing.

### Ghost Traces
Every execution leaves a faint transparent echo of the path it traveled. The last several executions accumulate as layered ghosts behind the active state.

- **Passing/neutral traces:** Transparent white fading
- **Failed execution traces:** Red turbulence color (`#A32D2D` → `#E24B4A`) — failure visible at the exact card where execution broke
- Maximum **10** ghost traces rendered simultaneously per connection
- Hot paths appear warmer from accumulated trace layering
- Ghost traces older than **30 days** are removed

### Minimap
Fixed 12px wide element at the **right edge of the viewport**, full viewport height, no border, no background. Each card is a colored segment proportional to its scroll height. Idle cards use card type colors:

| Card Type | Idle Color |
|-----------|-----------|
| Input | `#1D9E75` teal |
| Prompt | `#7F77DD` purple |
| Model | `#BA7517` amber |
| Tool | `#D85A30` coral |
| Memory | `#378ADD` blue |
| Logic | `#888780` gray |
| Output | `#1D9E75` teal |
| Eval | `#639922` green |
| Gap | `#7F77DD` purple flickering |

Non-idle cards use their state color. Clicking a segment snaps scroll to that card. Hovering shows tooltip: `[Card Type] — [card name or first line of config]`. Current viewport position shown as subtle white bracket overlay.

### Navigation at Scale

**Section labels:** Every Logic Card branch creates a named section. The label floats at the branching point and remains visible as a scroll anchor while scrolling through that section.

**Failure navigation:** When an execution fails, the spine automatically scrolls to the failed card.

**Affected card navigation:** When impact analysis surfaces affected cards that are off-screen, a count indicator appears at the scroll edge in the direction toward them. Clicking the indicator scrolls to the nearest affected card.

---

## Interaction Behaviors

### Card & Spine Interactions

| Interaction | Behavior |
|-------------|---------|
| Click card (idle) | Zooms spine to card, surface magnifies for editing |
| Click void (zoomed) | Zooms back out to spine view |
| Scroll (spine view) | Moves camera through spine depth |
| Pinch out (trackpad) | Zooms to full overview — all cards visible |
| Pinch in (overview) | Zooms back to spine view at pinch center |
| Click card (overview) | Snaps to card at full zoom |
| Right-click connection | Radial: **Wrap with Eval** / **Remove** |
| Drag from output port | Initiates connection — compatible input ports highlighted |
| Drop on compatible input port | Creates connection if types match |
| Drop on void | Opens compatible card picker at drop point |
| Escape while picker open | Cancels — no card created |
| Click void while picker open | Cancels — no card created |
| Escape (editing) | Discards edit, returns to idle |
| Escape (`suggestions_visible`) | ⚠️ Not explicitly specified in the v1 spec — requires a design decision before implementation |
| Enter (editing) | Commits edit (single-line fields) |
| Cmd+Enter (editing) | Commits edit (multi-line fields) |
| Escape (confirming) | Rejects proposal |
| Enter (confirming) | Confirms proposal |
| Click port label | Creates suggested card type, connects automatically |

### Keyboard Shortcuts

| Shortcut | Action |
|---------|--------|
| Space | Toggle between spine view and full overview |
| Escape | Zoom out one level |
| Cmd+Z | Undo last confirmed change (Live state only) |
| Cmd+Shift+Z | Redo (Live state only) |

### Undo / Redo
Operates on **confirmed spine mutations** only — not in-progress edits. Each undo reverts the spine graph to the previous versioned state and recompiles. **Only available in Live state.** Not available in Sealed state — use PendingChange queue to correct Sealed edits.

---

## Card Creation Gestures

Two gestures, both canonical. Neither is preferred over the other.

### Gesture A — Port Label Affordance (Guided)
Unconnected output ports show a subtle label: `"Connect to a [suggested type] →"`. Label shows the most contextually appropriate downstream type based on the current card type and port type.

**Clicking the label:**
1. Suggested card materializes inline immediately below the current card
2. Connection forms automatically between output port and new card's input port
3. New card enters `editing` state immediately
4. Label disappears — port is now connected

**Conditions:** Live state only. Not on `any`-type ports where no suggestion is unambiguous.

### Gesture B — Drag to Void (Experienced)
Dragging from any output port into empty spine space trails a thin ribbon of light from the port. Releasing on void opens an inline card picker showing only card types compatible with the dragged port's output type (max 6 options). Selecting creates and connects automatically. Escape or click-void dismisses without creating.

**Conditions:** Live state only. Available on all card types including Logic Card branch outputs.

### First-Card Special Case
The spine opens with a single unconfigured Input Card. The port label **does not appear** until the card has at least one configured field. This prevents wiring an unconfigured Input Card and producing an immediate type mismatch.

---

## UX & First-Run Affordances

### No Onboarding Flow
First open: no project setup, no configuration wizard, no template selection, no onboarding flow. The screen shows a near-black void with a single Input Card at the top of the spine — unconfigured, soft neutral inner glow. That is the entire first-run experience.

### Empty State Labels
Every card type has an inline empty state label that appears on the card face when unconfigured. These are the **only** first-run affordances — no wizard, no tooltips, no modals:

| Card Type | Empty State Label |
|-----------|------------------|
| Input | "What enters your system?" |
| Prompt | "What should this prompt do?" |
| Model | "Which model handles this?" |
| Tool | "What can this agent do?" |
| Memory | "How does this system remember?" |
| Logic | "When should this branch?" |
| Output | "Where does this go?" |
| Eval | "What does good look like here?" |

**Gap Cards have no empty state label.** They are system-generated only — never user-created, nothing to configure.

### Variable Binding
In the Prompt Card, highlighting any text creates a variable immediately — it glows blue at the point of binding and becomes a typed input port wired to upstream connections. The `{variable}` syntax also creates a variable automatically. No separate schema definition step.

---

## Confirmation State UI

### Card Visual During Confirmation
- **Back layer (current):** Card surface dims to 40% opacity. Current configuration visible but grayed.
- **Front layer (proposed):** Full opacity. Proposed configuration rendered. Changed elements with subtle amber outline.

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

**Never shown in the confirmation panel:** File names, paths, generated code, TypeScript types, compilation details, compilation logs, Vercel details, deployment details, raw provider errors.

**Per-card panel additions:** Some cards extend the general panel with additional context. Prompt Card adds a before/after preview directly above the change summary:
```
Before: [first 80 characters of previous prompt text]
After:  [first 80 characters of new prompt text]
```

**Partial acceptance:** Not available in v1. The user confirms or rejects the entire proposal.

**Rejection:** Explicit user rejection discards the unconfirmed edit, leaves the spine at its latest persisted confirmed state. No spine mutation. No compilation. Ghost trace does not emit. System returns to `idle`.

---

## Telemetry & Redaction Rules

Treat these as hard security constraints, not optional policies.

**Rule 1 — Secrets never stored.** Secret values never flow through ports and cannot appear in traces. `CardSecretReference` manages secrets entirely outside port flow.

**Rule 2 — `rawResponse` redaction.** `rawResponse` is not persisted when any declared output field is `sensitive: true`, unless the raw response is schema-redacted before storage. `rawResponse` is excluded from Eval Card inputs — Eval Cards receive Model Card structured values only.

**Rule 3 — Output Card delivery payloads.** Content delivered to Slack, email, webhooks, or API responses is stored as **schema only** — never values. Delivery confirmation (success/failure, timestamp) is stored.

**Rule 4 — Sensitive field marking.** Any field in an Input Card or Prompt Card output schema can be marked `sensitive: true`. Sensitive fields stored as `[REDACTED]` in traces — field name stored, value not stored. Marking a field sensitive is a config change, available in both Live and Sealed state.

**Rule 5 — Default storage.** Non-sensitive, non-delivery values stored for the rolling retention window.

**Rule 6 — User-initiated deletion.** User can delete all execution traces at any time. Permanently removes execution traces, Eval history, and ghost traces. Ghost traces clear from the renderer immediately.

**Rule 7 — Encryption at rest.** All stored `values` in `RedactedSnapshot` are encrypted at rest. Encryption key is per-user. Users do not manage keys directly.

**Secrets → Vercel:** During Seal and Release, secrets are pushed to Vercel as **environment variables**. They must never appear in generated Next.js source code.

---

## PendingChange Rebase Rules

Applied before every Release. Every queued `PendingChange` is evaluated against the current `SealedSnapshot` spine graph before compilation begins.

| Rule | Condition | Resulting Status |
|------|-----------|-----------------|
| 1 | Target card exists, config path unchanged | `queued` — applies as authored |
| 2 | Target card exists, config path changed but intent semantically preservable | `rebased` — auto-remapped, user shown plain-language note |
| 3 | Target card deleted | `conflicted` — Gap Card surfaces, Release blocked |
| 4 | Target card structurally incompatible (ports altered, type changed) | `conflicted` — same as Rule 3 |
| 5 | Current config already matches proposed change | `included_in_release` as no-op — no user action required |

`conflicted` changes block Release until resolved or rejected. The user can inspect and reject individual entries from the Output Card face in Sealed state. Successful Release clears `included_in_release` entries atomically with the `SealedSnapshot` update. Failed Release preserves the entire queue.

**On Return to Live with a pending queue:** Queue is preserved. Live spine initializes from the current `SealedSnapshot`. User is shown: *"X queued production changes will apply on your next release."*

---

## Persistence Model

| Data | Storage | Retention |
|------|---------|-----------|
| Spine graph state | Spineless cloud database | Permanent, versioned — every confirmed mutation creates a version entry |
| SealedSnapshot (current) | Spineless cloud database | Permanent per snapshot |
| SealedSnapshot (history) | Spineless cloud database | Retained for N releases |
| PendingChange queue | Spineless cloud database | Until included entries clear on successful Release; failed Release preserves queue |
| Generated Next.js project | Vercel (per deployment) | Managed by Vercel |
| Execution traces | Spineless cloud database | Rolling **30-day** window |
| Ghost trace data | Spineless cloud database | Rolling **30-day** window |
| Eval Card results | Spineless cloud database | Rolling **90-day** window |
| Cost and latency history | Spineless cloud database | Rolling **90-day** window |
| Secrets | Spineless encrypted secrets store | Permanent until deleted |
| Memory/vector/RAG data | External provider (user-configured) | Provider-managed |

---

## Engineering Acceptance Criteria

Key measurable targets from the implementation spec (doc 08, section 14):

- Card edit commits trigger impact analysis within **16ms** of commit event
- Impact analysis completes in **<100ms** for spines ≤50 cards; streams progressively beyond that
- Affected cards pulse within **16ms** of their individual analysis result arriving
- Agent invoked only after user resolves or dismisses all suggestions; never blocks the UI thread
- Confirmation panel surfaces within **500ms** of agent returning proposal
- Spine mutation and compilation complete within **2 seconds** of confirmation for spines ≤50 cards
- Compilation failure rolls back spine mutation **atomically**
- Gap Card surfaces within **16ms** of compilation failure detection
- Ghost trace renders within **500ms** of execution job completion; max **10** ghost traces per connection; removed after **30 days**
- Eval results stream to client within **500ms** of each execution step completing
- Production URL surfaces on Output Card within **30 seconds** of Seal confirmation
- Sealed structural controls must be visually locked and non-interactive — not just server-rejected

---

## Scope Boundaries (v1)

Out of scope: collaboration, mobile, template library, code visibility for users, existing codebase analysis, autonomous agent writes (agent writes only on user confirmation), Python (deferred post-v1), Parser Card.

Output target: **Next.js / TypeScript only** in v1.
