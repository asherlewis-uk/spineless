# Spineless — The Agent Model & Compilation
**Version 2.0 | Source of Truth**

---

## The Agent Model

### Principle
Autonomous reasoning. Confirmed writing.

The agent understands the entire system before proposing anything. It never makes narrow, card-scoped edits. Every proposal is the result of system-wide reasoning against the full spine state and the full generated codebase.

### What the Agent Mutates
The agent mutates **spine state only**. It never mutates source files directly. The compiler deterministically generates source from the updated spine state. Generated files are internal compilation artifacts — never the canonical state.

```
User edits card
      ↓
Impact analysis runs against spine graph
      ↓
Agent proposes semantic spine mutations (SpineMutationProposal)
      ↓
User confirms proposal
      ↓
      ├─── Live state ──────────────────────────────┐
      │    Spine state updates                       │
      │          ↓                                   │
      │    Compiler runs deterministically            │
      │          ↓                                   │
      │    Generated files produced                  │
      │          ↓                                   │
      │    Live Runtime Sandbox updated              │
      │                                              │
      └─── Sealed state ────────────────────────────┘
           PendingChange appended to queue
           Current SealedSnapshot NOT mutated
           No compilation
           No deployment
           (compilation and deployment occur only on Release)
```

The same spine state always produces the same files. The system is deterministic. There is one source of truth: the spine graph.

### Trigger
Any card reconfiguration or edit by the user triggers the agent after impact analysis resolves and the user accepts or dismisses suggestions.

### Context
The agent receives on every invocation:
- The full spine state — every card, every connection, every configuration
- The complete dependency graph
- The full generated codebase
- The specific edit that triggered invocation
- Impact analysis results — blast radius, affected cards, suggestions already surfaced

### Proposal
The agent returns a `SpineMutationProposal` — a structured set of semantic spine changes. It surfaces as a confirmation state directly on the triggering card. The card bifurcates into two depth layers: current state behind, proposed state in front. A plain-language summary and "Also affects" list appear on the card face. No file names, no code, no technical details — only semantic change descriptions.

### Failure Mode
If the agent cannot produce a safe proposal, it returns a `GapCardSpec`. The Gap Card materializes at the point of uncertainty. The user resolves it. The agent proceeds.

---

## Impact Analysis

### Principle
Runs the moment the user commits an edit. Before the agent is invoked.

### Blast Radius
For every card edit:
- **Upstream** — what feeds into this card (rarely affected, always checked)
- **Downstream direct** — cards that directly consume this card's output
- **Downstream transitive** — cards further down the chain
- **Sibling** — parallel paths sharing a common ancestor

### Budget and Progressive Behavior
- **Target:** <100ms for spines ≤50 cards
- **Progressive:** For spines >50 cards or analysis exceeding 100ms, results stream as each subgraph resolves. Affected cards pulse as their results arrive. The triggering card enters `analysis` state immediately.
- **Hard timeout:** 5 seconds. On timeout, all unanalyzed cards marked `affected` as precaution. Gap Card surfaces at triggering edit. Analysis does not block viewing or scrolling.

### Visual Encoding
- Downstream direct conflicts → pulse red immediately
- Downstream transitive risks → pulse amber
- Sibling adjustments → pulse amber at lower intensity
- Clean downstream → no visual change

### Resolution Suggestions
Affected cards surface the smallest safe resolution directly on the card face — plain language, user-facing. Accepted suggestions queue as additional spine mutations included in the agent proposal. Rejected suggestions leave the affected card in `needs_resolution` state.

---

## The Gap Card as a System Mechanism

Gap Cards are not error states. They are a first-class mechanism that holds the system's open questions in the same space where all other decisions are made.

A system with blocking Gap Cards cannot compile or release. Warning and instruction Gap Cards allow the system to proceed with explicit acknowledgment of the gap.

```typescript
type GapSeverity = 'blocking' | 'warning' | 'instruction';

interface GapCardSpec {
  insertAfterCardId: string;
  question: string;
  context: string;
  suggestedAction: string;
  severity: GapSeverity;
  deferrable: boolean;
  source:
    | 'compiler_failure'
    | 'analysis_timeout'
    | 'structural_change_in_sealed'
    | 'agent_unresolvable'
    | 'pending_change_conflict'
    | 'deferred_design_decision';
}
```

Auto-resolution occurs when the system detects the gap's source condition no longer exists. Auto-resolved Gap Cards dissolve with a brief teal pulse.

---

## Compilation Model

### Principle
The spine is the source of truth. Generated code is a byproduct. The user never edits generated code directly.

### What Compiles

| Card Type | Generated Output |
|-----------|-----------------|
| Input Card | API endpoint, webhook receiver, or form handler with validation |
| Prompt Card | Templated prompt function with typed variable injection |
| Model Card | LLM client call with parameters, retry logic, rate limiting, schema validation |
| Tool Card | Function-calling schema and sandboxed execution handler |
| Memory Card | Database initialization, retrieval layer, indexing logic |
| Logic Card | Conditional execution flow with typed branch paths |
| Output Card | Response formatter and delivery handler |
| Eval Card | Fully async middleware wrapper at correct execution location |

### Compilation Pipeline Stages

```
Stage 1: VALIDATE_GRAPH
  Verify all connections valid, required ports connected,
  no circular dependencies, all card configs complete.
  On failure: surface Gap Cards, abort.

Stage 2: RESOLVE_EXECUTION_ORDER
  Topological sort of card dependency graph.

Stage 3: INFER_SCHEMAS
  Propagate type information through graph.
  Verify port type compatibility at every connection.

Stage 4: GENERATE_COMPILATION_PLAN
  Determine file-level diff from current to target state.

Stage 5: GENERATE_SOURCE_ARTIFACTS
  Generate Next.js / TypeScript files for each card.
  Inject Eval Card async middleware at correct connection points.

Stage 6: TYPECHECK
  Run TypeScript compiler in check mode.
  On failure: surface Gap Card at responsible card, roll back spine mutation.

Stage 7: UPDATE_RUNTIME
  Live state: push to Live Runtime Sandbox, hot-reload.
  Sealed state: package as deployment artifact, push to Vercel via API.

Stage 8: PERSIST_SNAPSHOT
  Store compiled project hash and spine graph version.
  Update SealedSnapshot if this was a Seal or Release action.

Stage 9: SURFACE_RESULT
  Update card states, emit ghost trace,
  surface new Eval Card baselines, update cost/latency history.
```

### Compilation Triggers
Compilation runs on every confirmed Live spine mutation. It is never manual. In Sealed state, confirmed changes queue as `PendingChange` entries — compilation runs only on Release.

---

## Live / Sealed Compilation Boundary

### Live
Every confirmed change compiles immediately. The running Live sandbox always reflects the current spine state. No deploy step. No build step the user initiates.

### Sealed
Compilation locked to the Sealed snapshot. Confirmed changes queue as `PendingChange` entries. The production system reflects the last Sealed snapshot until Release.

### Release
Validates and rebases accumulated `PendingChange` entries, applies included entries to the current SealedSnapshot spine graph to produce a new SealedSnapshot candidate, compiles the result, and pushes to Vercel. The new compiled output becomes the running system. Included queue entries clear atomically with the new SealedSnapshot. Failed Release preserves the queue. The system remains in Sealed state.

### Returning to Live
The user can return to Live state at any time. The pending queue is **preserved**. Live spine initializes from the current SealedSnapshot. PendingChange entries remain queued and must be rebased, included, rejected, or marked conflicted before Release. The user is shown: "X queued production changes will apply on your next release."
