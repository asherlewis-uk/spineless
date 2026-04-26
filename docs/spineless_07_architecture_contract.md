# Spineless — Architecture Contract
**Version 2.0 | Source of Truth**

---

## 1. Source of Truth

The agent mutates **spine state only**. The compiler deterministically generates source from spine state. Generated files are internal compilation artifacts — never the canonical state. There is one source of truth: the spine graph. Everything else is derived from it.

---

## 2. Canonical Edit Lifecycle — State Machines

### Live State Edit Path

```
IDLE
  ↓ user edits card
EDITING
  ↓ user commits edit (blur, enter, explicit save)
IMPACT_ANALYSIS
  ↓ resolves (<100ms target, progressive if exceeded)
SUGGESTIONS_VISIBLE          ← skip if no suggestions
  ↓ user accepts/rejects (or auto-proceeds if none)
AGENT_INVOKED
  ↓ agent returns SpineMutationProposal
CONFIRMING
  ↓ user confirms
SPINE_MUTATING
  ↓ spine graph updated
COMPILING
  ↓ compiler runs deterministically
LIVE_RUNTIME_UPDATING
  ↓ Live sandbox hot-reloaded
SPINE_SETTLED
  ↓ ghost trace emitted, affected cards resolved
IDLE

  → user rejects at CONFIRMING:
      unconfirmed edit is not applied by explicit rejection;
      spine remains at latest persisted confirmed state → IDLE

  → compiler fails at COMPILING:
      spine mutation rolls back atomically
      Gap Card surfaces at failure point → IDLE
```

State-machine diagrams use uppercase labels for readability. Implementation enum values are lowercase snake_case.

### Sealed State Edit Path

```
IDLE (Sealed)
  ↓ user makes confirmational change
EDITING  (config fields only — structural controls locked)
  ↓ user commits edit
IMPACT_ANALYSIS
  ↓
SUGGESTIONS_VISIBLE          ← skip if none
  ↓
AGENT_INVOKED
  ↓ agent validates:
      structural mutation? → Gap Card "Return to Live to continue"
      config mutation?     → SpineMutationProposal
CONFIRMING
  ↓ user confirms
PENDING_CHANGE_QUEUED
  ← PendingChange appended to queue
  ← SealedSnapshot NOT mutated
  ← NO compilation
  ← NO deployment
  ↓
SPINE_SETTLED  ← pending indicator appears on card
  ↓
IDLE (Sealed)
```

### Release Path

```
user triggers Release
  ↓
RELEASE_VALIDATING
  ← validate/rebase PendingChange queue against current SealedSnapshot
  ↓ conflicts? → Gap Cards surface, IDLE (Sealed)
  ↓ clean?
RELEASE_COMPILING
  ← apply queue to SealedSnapshot spine graph, compile
  ↓
RELEASE_DEPLOYING
  ← push to Vercel API
  ↓ failure? → Output Card surfaces sealed_error, queue preserved, retry available
  ↓ success?
SNAPSHOT_UPDATING
  ← SealedSnapshot updated
  ← included PendingChange entries cleared atomically
  ← production URL updated if changed
  ↓
SPINE_SETTLED  ← pending indicators clear
  ↓
IDLE (Sealed)
```

### Return to Live Path

```
user triggers Return to Live
  ↓ PendingChange queue exists?

  → YES: queue PRESERVED
         Live spine initializes from current SealedSnapshot
         PendingChange entries remain in queue
         validated/rebased before next Release after next Seal
         user shown: "X queued production changes will apply on your next release"

  → NO: Live spine initializes from current SealedSnapshot

  ↓
System transitions to Live state
Crystallization dissolves — cold-to-warm visual reversal
```

---

## 3. Live, Seal, Sealed, and Release — Definitions

**Live (state):** Working state. Fully editable. Continuous compilation. Live Runtime Sandbox — a managed sandboxed execution environment within Spineless infrastructure for testing only. Not user-facing. No external URL.

**Seal (action):** Promotes current Live spine to a production snapshot.
1. Captures spine state as immutable SealedSnapshot
2. Compiles to complete Next.js project
3. Pushes to Vercel via API
4. Receives live production URL
5. Surfaces URL on Output Card
6. Transitions system to Sealed state

**Sealed (state):** Production state. Config changes allowed and queue as PendingChange. Structural changes not allowed — become Gap Cards instructing return to Live.

**Release (action):** Validates and rebases the PendingChange queue against the current SealedSnapshot, applies included changes to a new SealedSnapshot candidate, compiles, deploys, updates the current SealedSnapshot, and clears included queue entries on success. Failed Release preserves the queue. System remains Sealed after Release.

---

## 4. Deployment Model

**Local editor + Vercel-managed cloud runtime.**

Spineless is a web application. The spine editor runs in the browser. Generated systems deploy to Vercel via Spineless-managed API integration. The user never touches Vercel directly.

**One-time connection:** On first Seal, Spineless initiates Vercel OAuth. The user authenticates in a floating auth surface within Spineless. The resulting token is stored encrypted in the Spineless secrets store. Never shown again.

**Per-Seal/Release:** Spineless packages the compiled Next.js project, creates or updates a Vercel project, pushes the deployment, waits for confirmation, returns the production URL to the Output Card. Deployment progress surfaces on the Output Card face: compiling → deploying → live.

---

## 5. Persistence Model

| Data | Storage | Durability |
|------|---------|-----------|
| Spine graph state | Spineless cloud database | Permanent, versioned |
| SealedSnapshot (current) | Spineless cloud database | Permanent per snapshot |
| SealedSnapshot (history) | Spineless cloud database | Retained for N releases |
| PendingChange queue | Spineless cloud database | Until included entries clear on successful Release; failed Release preserves the queue |
| Generated Next.js project | Vercel (per deployment) | Managed by Vercel |
| Execution traces | Spineless cloud database | Rolling 30-day window |
| Ghost trace data | Spineless cloud database | Rolling 30-day window |
| Eval Card results | Spineless cloud database | Rolling 90-day window |
| Cost and latency history | Spineless cloud database | Rolling 90-day window |
| Secrets | Spineless encrypted secrets store | Permanent until deleted |
| Memory/vector/RAG data | External provider (user-configured) | Provider-managed |

Every confirmed spine mutation creates a version entry. Full mutation history exists as the foundation for a future version history browser.

---

## 6. Eval Card Runtime Architecture

Eval Cards compile to **fully async middleware wrappers** inserted at the correct position in the generated execution chain. They observe Card A's already-produced output off the execution path. They never re-execute Card A. They never block execution.

```typescript
// Canonical Eval middleware — fully async, zero execution latency
async function evalMiddleware(aOutput: AOutput, evalId: string): Promise<AOutput> {
  void evalEngine
    .evaluate({ evalId, output: aOutput, timestamp: Date.now() })
    .then(result => evalEngine.stream(evalId, result))
    .catch(() => evalEngine.recordTelemetryGap(evalId));
  return aOutput;
}

// In the generated execution chain:
const aOutput = await cardA_execute(input);
const passthrough = await evalMiddleware(aOutput, 'eval_uuid');
const bOutput = await cardB_execute(passthrough);
```

If the eval engine is unavailable, `recordTelemetryGap` fires and execution continues. Eval results never retroactively affect a completed execution — they inform future suggestions only.

---

## 7. Structured Output — Prompt Card and Model Card Semantics

**Prompt Card** is a declaration. It does not execute anything. It defines the prompt template and expected output schema.

**Model Card** is the executor. It receives the compiled prompt, executes the LLM call, validates output against the declared schema, and produces the actual runtime values.

**Downstream cards consume Model Card output**, not Prompt Card output. Prompt Card output ports are visual/schema aliases only. They declare fields the connected Model Card must produce. At runtime, the connected Model Card exposes and transmits the actual values derived from that schema.

```typescript
// Prompt Card declares — compile-time only
interface PromptDeclaration {
  template: string;
  variables: Record<string, PortType>;
  declaredOutputSchema: Record<string, PortType>;
}

// Edge payload Prompt → Model — runtime
interface PromptToModelPayload {
  compiledPrompt: string;
  declaredOutputSchema: Record<string, PortType>;
}

// Model Card produces — runtime output consumed by downstream
interface ModelOutputPayload {
  values: Record<string, unknown>;
  rawResponse?: string;                // not persisted if any declared output field is sensitive unless schema-redacted; never user-facing
  tokenUsage: { input: number; output: number };
  latencyMs: number;
  cost: number;
}
```

If the model produces output that does not match the declared schema, the Model Card enters `error` state. Plain-language mismatch description surfaces on the card face.

**Parser Card is not a v1 card type.** Structured output in v1 is handled by Prompt Card declared output schema plus Model Card structured-output enforcement.

---

## 8. System Boundary Topology

```
┌─────────────────────────────────────────────────────────┐
│  SPINELESS BROWSER CLIENT                               │
│  ┌─────────────────┐  ┌──────────────────────────────┐ │
│  │ WebGL Spine      │  │ React Card Interaction Layer │ │
│  │ Renderer         │  │ (HTML overlay on WebGL)      │ │
│  └────────┬─────────┘  └──────────────┬───────────────┘ │
│           └──────────┬─────────────────┘                 │
│                 Spine State (client)                     │
└──────────────────────┬──────────────────────────────────┘
                       │ WebSocket + REST
┌──────────────────────▼──────────────────────────────────┐
│  SPINELESS SERVER                                        │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Spine Graph  │  │ Impact        │  │ Agent        │ │
│  │ Store        │  │ Analysis      │  │ Runtime      │ │
│  └──────┬───────┘  │ Engine        │  └──────┬───────┘ │
│         │          └───────────────┘         │          │
│  ┌──────▼───────────────────────────────────▼───────┐  │
│  │ Compiler (Spine Graph → Next.js / TypeScript)     │  │
│  └──────────────────────┬────────────────────────────┘  │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │ Live Runtime Sandbox (testing only, not production)│  │
│  └────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────┐ │
│  │ Telemetry    │  │ Eval Engine   │  │ Secrets      │ │
│  │ Store        │  │               │  │ Store        │ │
│  └──────────────┘  └───────────────┘  └──────────────┘ │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Sealed Release Manager                            │   │
│  │ (SealedSnapshot, PendingChange queue, Release)    │   │
│  └──────────────────────┬───────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │ Vercel API
┌─────────────────────────▼───────────────────────────────┐
│  VERCEL                                                  │
│  Generated Next.js deployments                          │
│  Production runtime, environment variables, URLs        │
└─────────────────────────────────────────────────────────┘
```

---

## 9. Canonical Data Contracts

```typescript
type SystemMode = 'live' | 'sealed';

type LifecycleStage =
  | 'idle' | 'editing' | 'impact_analysis' | 'suggestions_visible'
  | 'agent_invoked' | 'confirming' | 'spine_mutating' | 'compiling'
  | 'live_runtime_updating' | 'pending_change_queued'
  | 'release_validating' | 'release_compiling'
  | 'release_deploying' | 'snapshot_updating' | 'spine_settled';

type CardState =
  | 'idle' | 'editing' | 'active' | 'passing' | 'error' | 'sealed_error'
  | 'affected' | 'needs_resolution' | 'confirming' | 'sealed'
  | 'unresolved' | 'pending' | 'analysis';

type CardType =
  | 'input' | 'prompt' | 'model' | 'tool' | 'memory'
  | 'logic' | 'output' | 'eval' | 'gap';

type PortType = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any';

type MutationScope = 'live_only' | 'both';

type GapSeverity = 'blocking' | 'warning' | 'instruction';

interface Port {
  id: string;
  label: string;
  type: PortType;
  schema?: Record<string, PortType>;
  required: boolean;
  direction: 'input' | 'output';
  sensitive: boolean;   // true = values redacted in execution traces
}

// Secrets never enter port flow — managed separately
interface CardSecretReference {
  secretKey: string;
  requiredBy: string;
  purpose: string;
}

interface Card {
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

interface SpinePosition {
  depth: number;
  track: number;
  zOffset: number;
}

interface Connection {
  id: string;
  sourceCardId: string;
  sourcePortId: string;
  targetCardId: string;
  targetPortId: string;
  valid: boolean;
  evalCardId?: string;
}

interface SpineGraph {
  id: string;
  cards: Record<string, Card>;
  connections: Record<string, Connection>;
  executionOrder: string[];
  version: number;
  updatedAt: number;
}

interface SpineMutation {
  cardId: string;
  mutationType:
    | 'update_config'       // both
    | 'update_ports'        // live_only
    | 'update_output_schema'// live_only
    | 'add_card'            // live_only
    | 'remove_card'         // live_only
    | 'add_connection'      // live_only
    | 'remove_connection'   // live_only
    | 'resolve_gap'         // both
    | 'rotate_secret';      // both
  payload: Partial<Card> | Partial<Connection>;
  allowedIn: MutationScope;
}

interface SpineMutationProposal {
  triggeredBy: string;
  spineGraphVersion: number;     // version at agent invocation — stale check at confirmation
  mutations: SpineMutation[];
  userDescription: string;
  downstreamEffects: string[];
}

interface ImpactAnalysisResult {
  triggeredBy: string;
  affected: AffectedCard[];
  suggestions: ResolutionSuggestion[];
  hasUnresolvable: boolean;
}

interface AffectedCard {
  cardId: string;
  severity: 'conflict' | 'risk' | 'adjustment';
  reason: string;
}

interface ResolutionSuggestion {
  affectedCardId: string;
  description: string;
  mutationType: 'schema_update' | 'config_update' | 'connection_update';
  mutation: Partial<CardConfig>;
}

interface GapCardSpec {
  insertAfterCardId: string;
  question: string;
  context: string;
  suggestedAction: string;
  severity: GapSeverity;
  deferrable: boolean;
  source:
    | 'compiler_failure' | 'analysis_timeout' | 'structural_change_in_sealed'
    | 'agent_unresolvable' | 'pending_change_conflict' | 'deferred_design_decision';
}

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
  baseSnapshotId: string;
  targetCardId: string;
  targetConfigPath: string;
  mutation: SpineMutation;
  userDescription: string;
  createdAt: number;
  status: 'queued' | 'rebased' | 'conflicted' | 'included_in_release' | 'rejected';
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

## 10. Execution Lifecycle

**Job-based, streaming.** Each execution is a job with a unique ID. Results stream back via WebSocket as each card completes. The spine animation responds in real time — each card activates and settles as its step resolves.

**Retries:** Configurable on Model Card face. Generated model client handles transparently. Extended amber state during retry. Error state after max retries.

**Timeouts:** Model Cards default 30s, Tool Cards default 10s. Configurable on card face.

**Error mapping:**

| Error Type | Card State | Spine Behavior |
|-----------|-----------|---------------|
| Model provider outage | error | Red turbulence, amber downstream |
| Invalid API key | error | Red turbulence, secrets panel surfaces |
| Tool timeout | error | Red turbulence on Tool Card |
| Type validation failure | error | Red turbulence at validation point |
| Eval failure (non-blocking) | passing with red trace | Ghost trace red, execution continues |
| TypeScript compile error | gap | Gap Card surfaces, spine rolls back |
| Vercel deployment failure | sealed_error | Output Card surfaces error state |

---

## 11. Secrets, Permissions, and Sandboxing

**Secrets model:** Entered once through a card-adjacent secrets panel that surfaces inline when a card requires credentials it does not have. Stored encrypted in Spineless secrets store. Never shown again after entry — only a masked indicator that the secret exists. Pushed to Vercel as environment variables on Seal/Release. Never embedded in generated source code. Managed through `CardSecretReference` — secrets never enter port flow.

**Two distinct security concepts:**

| Concept | What It Is | Where It Lives | Redaction |
|---------|-----------|---------------|-----------|
| Secret | API key, credential, token | Secrets store, Vercel env vars | Never enters port flow |
| Sensitive field | User/customer data in port flow | Port value, execution trace | `port.sensitive: true` |

**Tool Card sandboxing:** Isolated serverless function contexts. No filesystem access. No cross-context access. Network access only to explicitly configured endpoints. Execution time limits enforced.

**OAuth integrations:** OAuth flow surfaces in a floating auth surface within Spineless. User authorizes once. Spineless manages token refresh.

---

## 12. Failure and Recovery

**Compiler failure:** TypeScript error → Gap Card at responsible card → spine mutation rolls back atomically → user resolves Gap Card → edit cycle restarts.

**Vercel deployment failure:** Output Card surfaces `sealed_error` → previous SealedSnapshot remains active → user can retry without re-authoring → failure in plain language on Output Card face.

**Model provider outage:** Execution fails → red turbulence → trace records failure → ghost trace renders red → system returns to idle → no spine state change.

**Corrupted spine state:** Spineless rolls back to last valid versioned spine state. User is shown which version was restored and what edits were lost.

**Failed Release:** If Release fails mid-compile or mid-deploy, pending queue is preserved in full. Current SealedSnapshot remains active. User can retry.

**Memory store unavailable:** Memory Card surfaces error state. Execution continues without memory context. Degraded execution recorded in trace.

---

## 13. Sealed-State Editing — Precise Definition

**Allowed in Sealed state (config changes):**
- Editing prompt text on a Prompt Card
- Editing system prompt on a Prompt Card
- Changing model parameters (temperature, max tokens, retry count, timeout) on a Model Card
- Updating Output Card format configuration
- Updating Output Card destination-specific config (channel, address)
- Updating Eval Card examples, assertions, and thresholds within minimum constraints
- Resolving Gap Cards (config-level resolutions only)
- Rotating secrets
- Marking port fields as sensitive

**Not allowed in Sealed state (structural changes — become Gap Cards):**
- Adding new cards
- Removing existing cards
- Adding new connections
- Removing connections
- Changing card types
- Changing field names or types
- Changing output schema fields
- Changing port definitions
- Changing model selection
- Changing delivery destination type on Output Card
- Any structural mutation

Structural attempts in Sealed produce an instruction Gap Card: "This change requires structural editing. Return to Live to continue."

---

## 14. Navigation at Scale

No jump menus, no sidebar navigation, no search-to-card in v1. Scroll and spatial memory are the primary navigation mechanisms. Minimap, pinch overview, failure auto-scroll, and affected card navigation handle scale. See document 03 for full minimap specification.

---

## 15. First-Run Affordances

No onboarding wizard. No template library. No natural language generation. Every card type has an empty-state label — a single plain-language question that describes what this card needs. The question disappears once the card has content. Port labels on unconnected output ports read "Connect to a [type] →". These affordances are inline, minimal, and disappear as the spine fills in.

---

## 16. Resolved / Deferred Architectural Decisions

| Decision | Status |
|----------|--------|
| Agent model selection | Provider choice deferred; v1 contracts remain implementation-ready and provider-agnostic |
| Spineless hosting target | Resolved by documents 08-10 for v1 implementation |
| Spine state persistence mechanism | Resolved by documents 08-10 for v1 implementation |
| Eval hook framework integration | Resolved by documents 08-10 for v1 implementation |
| Python second-phase scope | Deferred to post-v1 |
