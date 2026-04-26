# Spineless v1 — Phase Endstates

**Purpose.** This document defines the major architectural phases of Spineless v1 and the strict completion criteria each phase must satisfy before the next phase may begin. It is **not** a step-by-step plan and **does not** decompose work into micro-tasks. Each phase is gated by a verifiable endstate; the orchestrator advances only when every criterion below is met.

**Source of truth.** Docs 08–10 (with doc 10 superseding 08–09 on conflict). Docs 00–07 provide product/visual context.

**Scope reminder (v1).** Next.js / TypeScript output only. No collaboration, mobile, templates, code visibility, codebase ingestion, autonomous writes, Python, or Parser Card.

---

## Phase 1 — Canonical Spine Graph & State Machine

The deterministic core. Everything downstream derives from this. Pure logic, no rendering, no compilation, no agent.

### Endstate criteria
1. All canonical types from docs 09 and 10 are implemented in TypeScript: `SystemMode`, `LifecycleStage`, `CardState`, `CardType` (the nine v1 types — Parser Card explicitly absent), `SpineGraph`, `Card`, `Port`, `PortType` (no `'secret'` member), `Connection`, `SpineMutation`, `MutationScope`, `SpineMutationProposal`, `MutationRejection`, `GapCardSpec`, `CardSecretReference`, `PendingChange`, `SealedSnapshot`, `ModelOutputPayload`, `RedactedSnapshot`.
2. The `LifecycleStage` and `CardState` namespaces are independently subscribable. No code path infers one from the other. The shared `'editing'` literal is correctly disambiguated by namespace at every consumer.
3. The spine graph is versioned: every confirmed mutation produces a new `spineGraphVersion`, with the prior version retained.
4. `MutationScope` is enforced by the graph layer: `live_only` mutations submitted while `SystemMode === 'sealed'` are rejected at the contract boundary and converted to `GapCardSpec` with severity `instruction`. `update_config`, `resolve_gap`, and `rotate_secret` are accepted in both modes.
5. `CardState` transition table from doc 08 §2 is implemented as a pure reducer with exhaustive switch coverage. Invalid transitions throw in dev, no-op in production.
6. Version-locking is enforced: a `SpineMutationProposal` whose `spineGraphVersion` does not match current state returns `MutationRejection { latestSpineGraph }` rather than mutating.
7. Undo/redo operates on confirmed mutations only, is disabled while `SystemMode === 'sealed'`, and never touches in-progress edits.
8. Unit tests cover every `CardState` transition, every `MutationScope` rule, the version-lock rejection path, and the nine card types' port/schema invariants. Test suite is green in CI.
9. Zero dependencies on rendering, networking, agent, or compiler modules. The package is importable in a Node-only environment.

**Gate to Phase 2:** All nine criteria above pass in CI. The spine graph can be constructed, mutated, versioned, sealed, and reverted entirely through its public API with no UI present.

---

## Phase 2 — Persistence, Telemetry & Secrets Substrate

The storage and security layer that the rest of the system writes through. Built before any user-facing surface so that retention, redaction, and secret-isolation are structural, not retrofitted.

### Endstate criteria
1. Spine graph state, `SealedSnapshot` (current and history), and `PendingChange` queue persist to the Spineless cloud database with the retention semantics in doc 08 §Persistence.
2. Execution traces and ghost trace data persist on a 30-day rolling window. Eval results and cost/latency history persist on a 90-day rolling window. Eviction is automatic and tested.
3. `RedactedSnapshot.values` is encrypted at rest with a per-user key. Users do not manage keys directly. Key rotation is supported at the storage boundary.
4. Secrets are stored exclusively via `CardSecretReference` in an isolated encrypted secrets store. Secret values are inaccessible to the trace store, eval engine, agent runtime, and compiler source-emit paths by construction (compile-time type separation, not runtime check alone).
5. Telemetry redaction the telemetry redaction rules from doc 10 §7 (the controlling numbering) are enforced at the write boundary:
   - Secrets cannot enter port flow (type system prevents it).
   - `rawResponse` is dropped when any declared output field is `sensitive: true` and not pre-redacted.
   - `rawResponse` is excluded from Eval Card inputs.
   - Output Card delivery payloads store schema only; values never persist.
   - `sensitive: true` field values store as `[REDACTED]` with field name retained.
   - User-initiated deletion atomically removes traces, eval history, and ghost traces and clears the renderer's ghost cache.
   - All stored values in RedactedSnapshot are encrypted at rest with a per-user key.
6. `PendingChange` rebase rules 1–5 are implemented as pure functions over `(SealedSnapshot, PendingChange[])` and unit-tested for every status outcome (`queued`, `rebased`, `conflicted`, `included_in_release`, `rejected`). The `rejected` outcome is tested via the user-rejection path (Output Card face dismissal), not via the rebase path.
7. Integration tests confirm no code path writes a secret value, a sensitive field's raw value, or a delivery payload value to any persistent store.

**Gate to Phase 3:** All seven criteria pass in CI. A red-team test that asserts no secret string and no sensitive field value reaches the trace store under any input passes.

---

## Phase 3 — Compilation Pipeline & Live Runtime Sandbox

The deterministic generator from spine state to Next.js/TypeScript artifacts, plus the sandbox that runs them for Live mode.

### Endstate criteria
1. All nine compilation stages are implemented as a strictly ordered pipeline: `VALIDATE_GRAPH` → `RESOLVE_EXECUTION_ORDER` → `INFER_SCHEMAS` → `GENERATE_COMPILATION_PLAN` → `GENERATE_SOURCE_ARTIFACTS` → `TYPECHECK` → `UPDATE_RUNTIME` → `PERSIST_SNAPSHOT` → `SURFACE_RESULT`.
2. Stage 1 failures surface `GapCardSpec` at the offending card or connection and abort the pipeline without mutating spine state.
3. Stage 6 failures roll back the spine mutation atomically — no partial version commit, no orphaned snapshot — and surface a `GapCardSpec` at the responsible card within the 16ms target.
4. Eval Cards compile to fully async middleware that returns the upstream payload synchronously and dispatches evaluation as a fire-and-forget side effect. Card B never waits on Eval. Card A is never re-executed by Eval.
5. Prompt Card emits declaration only — no execution. Model Card emits the LLM call, output validation, and `ModelOutputPayload` construction. Downstream code generation reads from Model Card outputs, never Prompt Card outputs.
6. Secrets are emitted to Vercel as environment variables only. A static analysis check on generated source asserts that no `CardSecretReference` value appears as a literal in any emitted file. CI fails if violated.
7. The Live runtime sandbox executes generated artifacts on every successful compilation, streams structured execution events, and produces ghost-trace-ready records (max 10 per connection, capped at the source).
8. Compilation completes within 2 seconds for spines ≤ 50 cards on the reference machine. Performance regression test pinned in CI.
9. The compiler is a pure function of `SpineGraph` plus secret references: identical input produces identical output bytes (deterministic generation), enabling reproducible Releases.

**Gate to Phase 4:** All nine criteria pass in CI. A spine constructed via the Phase 1 API can compile, execute in the sandbox, and emit a structured trace — entirely headless.

---

## Phase 4 — Agent Middleware & Impact Analysis Engine

The reasoning layer. Proposes mutations; never writes them. Analyzes impact; never blocks the UI.

### Endstate criteria
1. The Impact Analysis Engine is invoked within 16ms of a card edit commit event and completes within 100ms for spines ≤ 50 cards. Beyond 50 cards, results stream progressively per affected card.
2. Impact analysis runs off the UI thread. No analysis path can block input handling, animation, or rendering frames.
3. The Agent Runtime is invoked only after the user resolves or dismisses every surfaced suggestion. It cannot be triggered while suggestions are still visible.
4. Every `SpineMutationProposal` the agent returns is bound to the `spineGraphVersion` captured at agent invocation. Proposals carry a plain-language change summary and per-card affected-cards list (no file paths, no code, no provider errors, no compilation logs).
5. Confirmation surfaces within 500ms of the agent returning a proposal.
6. The agent never mutates spine state directly. Mutations occur exclusively through the confirmed-proposal path defined in Phase 1. A test asserts no agent code path can construct a non-version-locked mutation.
7. In Sealed mode, agent proposals containing `live_only` mutations are converted to `GapCardSpec` with the canonical message and severity `instruction`, never queued, never written.
8. Eval Card invocation paths receive Model Card structured outputs only. Static check confirms `rawResponse` is never passed into an eval input.

**Gate to Phase 5:** All eight criteria pass in CI. End-to-end headless test: edit → impact analysis → agent proposal → confirmation → mutation → compilation → sandbox execution, with all latency budgets met.

---

## Phase 5 — WebGL Spine Renderer

The void, the spine, the materials, the animation. Subscribes to `LifecycleStage` for global animation and to spine geometry for layout. Does not host card interaction surfaces (those land in Phase 6).

### Endstate criteria
1. The renderer subscribes only to `LifecycleStage` and spine geometry. It does not read `CardState` and does not import card-interaction modules.
2. Spatial grammar is implemented as specified: scroll position = execution depth, branching = parallel vertical tracks that rejoin at a merge point, z-depth = abstraction level with parallax, zoom = inspection level. The spine never widens except via Logic Card branches.
3. The void renders as a near-black environment with organic ambient drift. No floors, walls, ceilings, external light sources, fog, smoke, or chrome are ever emitted by any code path. All light originates from within UI elements.
4. Glassmorphic materials with edge refraction, internal volume, and subtle boundary glitch are implemented and visually verified against the canon.
5. Color temperature encoding is enforced via a single shared palette module. The eight temperature bands map exactly to the canonical hex ranges. No card or state may render a color outside its assigned band.
6. Live → Sealed transition produces a crystallization wave traveling Input → Output: glass becomes ice, particle streams slow to near stillness, ribbons rigidify and brighten, frost appears at card edges. Sealed → Live reverses cleanly.
7. Execution animation sequence renders correctly: input flare → sequential card activation → Model amber latency pulse → particle acceleration on response → Logic branch brighten/dim → Output surface display → ghost trace fade-in. Failed executions render the red-turbulence ghost trace at the breaking card.
8. Ghost traces render within 500ms of execution job completion. Cap of 10 per connection enforced at the renderer. Older-than-30-day traces are not rendered.
9. The minimap renders at the right viewport edge as a 12px wide segmented strip, no border, no background, with idle card-type colors per the canonical table, state colors when non-idle, click-to-snap, hover tooltip, and white-bracket viewport overlay.
10. Section labels float at Logic Card branch points and persist as scroll anchors while the user is within that section.
11. Failure auto-scroll and off-screen-affected-card edge indicators are implemented and behaviorally tested.
12. Renders at the engineering performance targets on the reference machine without dropped frames during the canonical animation sequences.

**Gate to Phase 6:** All twelve criteria pass. The renderer can play back any spine produced by Phases 1–4 with full visual fidelity and no interaction layer present.

---

## Phase 6 — Card Interaction Layer

The HTML overlay on the WebGL canvas. Subscribes to `CardState` only. Hosts every direct user interaction with cards, ports, ribbons, and the picker.

### Endstate criteria
1. The interaction layer subscribes only to `CardState` and per-card geometry from the renderer. It does not read `LifecycleStage`.
2. All eight non-Gap card types render the canonical empty-state label when unconfigured. Gap Cards render no empty-state label. No onboarding flow, wizard, modal, tooltip, or template selector exists anywhere in first-run.
3. First open shows the void with a single unconfigured Input Card and nothing else.
4. Card creation Gesture A (port label affordance) and Gesture B (drag-to-void picker) are both implemented per spec, both Live-only, neither preferred. The first Input Card suppresses the port label until at least one field is configured.
5. The full interaction table from the canon is implemented and behaviorally tested: click/zoom transitions, scroll, pinch, right-click connection radial, port drag, drop targets, picker dismissal, edit commit/discard, confirmation accept/reject, port-label click.
6. Keyboard shortcuts are implemented: Space toggles overview, Escape zooms out one level, Cmd+Z and Cmd+Shift+Z operate on confirmed mutations in Live state only and are inert in Sealed.
7. The Escape behavior in `suggestions_visible` is explicitly resolved with a documented design decision before this phase ships. The decision is recorded in this repository.
8. Confirmation panel renders exactly the canonical content and never displays file names, paths, generated code, types, compilation details, logs, deployment details, or raw provider errors. Prompt Card before/after preview is included where applicable. No partial acceptance UI exists.
9. Sealed-mode structural controls are visually locked and non-interactive at the DOM/event level — not merely server-rejected.
10. Multi-tab behavior is implemented: second tab is read-only with the canonical banner; on primary close, the second tab reloads and enters edit mode after a 3-second delay.
11. Variable binding in Prompt Cards works via both text-highlight and `{variable}` syntax, creating typed input ports immediately, with the canonical blue glow.
12. All interaction latency targets are met: edit commit → impact analysis trigger ≤ 16ms; affected-card pulse ≤ 16ms after analysis arrives; Gap Card surface ≤ 16ms after compilation failure detection.

**Gate to Phase 7:** All twelve criteria pass. A user can construct, edit, confirm, and execute a complete spine end-to-end using only mouse and keyboard, with no developer tools open.

---

## Phase 7 — Sealed Release Manager & Vercel Deployment

The production boundary. Seal, queue, rebase, release, deploy, and return-to-Live.

### Endstate criteria
1. Seal transitions execute the crystallization animation, freeze structural mutations, and produce a `SealedSnapshot` persisted to the database.
2. The `PendingChange` queue accepts `update_config`, `resolve_gap`, and `rotate_secret` mutations in Sealed mode and rejects all `live_only` mutation types via the Phase 1 contract.
3. Rebase rules 1–5 from Phase 2 are invoked before every Release. `conflicted` entries surface as Gap Cards on the relevant cards and block Release until resolved or rejected from the Output Card face.
4. Successful Release atomically clears `included_in_release` entries and publishes the new `SealedSnapshot`. Failed Release preserves the entire queue with no partial application.
5. Release deploys the deterministically generated Next.js artifact to Vercel. Secrets are pushed as Vercel environment variables and never appear in any emitted source file (re-asserted via static check from Phase 3).
6. The production URL surfaces on the Output Card face within 30 seconds of Seal confirmation on the reference deployment path.
7. Return to Live preserves the `PendingChange` queue, initializes the Live spine from the current `SealedSnapshot`, and surfaces the canonical "X queued production changes will apply on your next release." message.
8. Sealed errors surface as `sealed_error` `CardState` and follow the documented retry/dismiss transitions.

**Gate to v1 release:** All eight criteria pass. A spine authored in Live can be Sealed, edited via the queue, Released, deployed to Vercel, observed at a public URL, and the queue/return-to-Live cycle completes cleanly. Phases 1–7 together satisfy every engineering acceptance criterion in doc 08 §14 and every scope boundary in doc 06.
