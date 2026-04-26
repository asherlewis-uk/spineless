# Spineless — The Card System
**Version 2.0 | Source of Truth**

---

## Overview

Cards are the atomic unit of Spineless. Every card is a live window into a real piece of the system — not a representation of something that exists elsewhere, but the thing itself, expressed visually.

The user authors cards. The spine graph records them. The compiler emits derived source artifacts from that graph.

Cards are never selected from a template library. They are authored — created with intent, configured with specificity, connected with purpose. A card that exists in the spine corresponds to something real in the compiled output. A card that does not exist produces nothing.

---

## Card Anatomy

Every card shares a common physical language regardless of type:

- **Glassmorphic surface** — translucent, physically thick, light refracting through edges
- **Internal glow** — all light is emitted from within the card, never from an external source
- **Connection ports** — typed input and output ports on card edges where spine connections attach
- **State encoding** — the card's light temperature, surface stability, and particle behavior encode its current state
- **Depth presence** — cards exist at genuine z-depth in the spine, not as flat elements on a canvas
- **Confirmation layer** — when a change is proposed, the card bifurcates into current and proposed depth layers without leaving its position in the spine

---

## Card Types

### Prompt Card
The prompt template as it will be compiled and passed to the model. Variables glow at their binding points within the text — not labeled separately, but highlighted at the point of binding.

**What it is:** A declaration. The Prompt Card does not execute anything. It defines the prompt template and the expected output schema. The Model Card executes the LLM call. Downstream cards consume Model Card output, not Prompt Card output. Prompt Card output ports are visual/schema aliases only. They declare fields the connected Model Card must produce. At runtime, the connected Model Card exposes and transmits the actual values derived from that schema.

**Authored by:** Writing prompt text directly on the card surface. Highlighting text creates a variable, which becomes a typed input port. Output schema fields are defined through the schema builder on the card face — each field becomes a declared output port.

**Compiles to:** Templated prompt function with type-safe variable injection and declared output schema.

**Impact behavior:** Editing prompt text triggers downstream impact analysis. Connected Model Cards check token fit and JSON mode compatibility. Connected Eval Cards flag drift risk. Variable removal pulses affected downstream cards amber.

---

### Model Card
The LLM executor. Receives the compiled prompt from its connected Prompt Card, executes the LLM call, validates output against the Prompt Card's declared schema, and produces the actual runtime values that downstream cards consume.

**Authored by:** Selecting model from a dropdown, adjusting parameter controls. Cost-per-run estimate visible on the card face. Latency from last execution shown as ambient heat. JSON mode auto-enables when connected Prompt Card has a defined output schema.

**Compiles to:** LLM client call with configured parameters, retry logic, rate limiting, structured output enforcement, and schema validation.

**Impact behavior:** Switching models auto-checks connected Prompt Cards for context window fit, tool support, and JSON mode capability. Cost estimate recalculates across the affected subgraph. Schema mismatch between model output and declared schema surfaces on the card face in plain language.

**Runtime output contract:**
```typescript
interface ModelOutputPayload {
  values: Record<string, unknown>;          // typed against declared schema
  rawResponse?: string;                     // not persisted if any declared output field is sensitive unless schema-redacted; never user-facing
  tokenUsage: { input: number; output: number };
  latencyMs: number;
  cost: number;
}
```

---

### Tool Card
An external capability the model can invoke via function calling.

**Authored by:** Naming the tool, defining inputs and outputs through typed port configuration on the card face. Port names become the function parameter names in the generated function-calling schema.

**Compiles to:** Function-calling schema registered with the connected Model Card. Executed in an isolated serverless function context with no filesystem access, no cross-context access, network access only to explicitly configured endpoints, and execution time limits.

**Impact behavior:** Adding or removing tools updates the connected Model Card's function-calling schema automatically. Execution sandbox permissions recalculate.

---

### Memory Card
The context retention strategy for a section of the system.

**Authored by:** Selecting retention strategy (conversation buffer / vector RAG / key-value / summary chain), configuring store type and retention window. Fill level visible as the card's internal depth changes.

**Compiles to:** Database initialization, retrieval layer, auto-indexing, and query logic appropriate to the selected strategy.

**Impact behavior:** Changing strategy type restructures the subgraph — adding embedding Model Cards where required, updating retrieval Prompt Cards with new available variables. Strategy changes are structural and not allowed in Sealed state.

---

### Logic Card
A control flow decision point. Branch, loop, or merge.

**Authored by:** Defining the condition using output variables from upstream Model Cards. Branch paths become distinct spine connections with labeled conditions.

**Compiles to:** Conditional execution logic in the compiled chain. Each branch is a real code path.

**Impact behavior:** Upstream output schema changes that affect the condition surface immediately on the Logic Card as amber pulse with resolution suggestion. Broken conditions — referencing variables that no longer exist — display in plain language on the card face.

---

### Input Card
The entry point where data enters the system.

**Authored by:** Defining input fields — name, type, validation rules. Each field becomes a typed output port. The card's output port label reads "Connect to a Prompt →" once at least one field is configured.

**Compiles to:** API endpoint with OpenAPI spec, form UI, or webhook receiver depending on configuration.

**Impact behavior:** Changing input schema propagates to all connected Prompt Cards. Variable bindings that reference changed fields pulse amber and surface resolution suggestions.

---

### Output Card
The exit point where the system delivers its result.

**Authored by:** Selecting format (JSON / markdown / plain text) and delivery destination (API response / webhook URL / email / Slack). Output schema is derived from upstream Model Card output.

**Compiles to:** Response formatting, delivery logic, and confirmation handling appropriate to the selected destination.

**Impact behavior:** Format schema changes that conflict with upstream output structure surface on the card immediately.

---

### Eval Card
A quality gate that wraps any spine connection. Observes execution output asynchronously, monitors quality continuously, surfaces drift and suggestions.

**Authored by:** Attaching to any connection between cards by right-clicking the ribbon. Providing example input/output pairs. The card absorbs examples and begins evaluating immediately.

**Compiles to:** Fully async middleware wrapper injected at the correct position in the generated execution chain. Eval Cards never block execution — they observe Card A's already-produced output off the execution path and stream results back to the spine asynchronously.

```typescript
// Canonical Eval middleware pattern
async function evalMiddleware(aOutput: AOutput, evalId: string): Promise<AOutput> {
  void evalEngine
    .evaluate({ evalId, output: aOutput, timestamp: Date.now() })
    .then(result => evalEngine.stream(evalId, result))
    .catch(() => evalEngine.recordTelemetryGap(evalId));
  return aOutput; // Card B receives output immediately — zero eval latency
}
```

**Impact behavior:** Moves with its target connection. Inherits variable schema from surrounding cards. Pass rate, drift, and failure traces visible directly on the card face — not in a separate dashboard. Drift detection generates agent-produced suggestions that surface on the card face without user action.

---

### Gap Card
An unresolved decision point. System-generated — never user-created.

**Generated when:** The agent cannot produce a safe proposal, compilation fails, impact analysis times out, a structural change is attempted in Sealed state, or a pending change conflicts after structural evolution.

**Resolved by:** The user taking the suggested action, or explicitly deferring the gap.

**Severity:**

| Severity | Behavior | Deferrable |
|----------|---------|-----------|
| Blocking | Compilation and Release cannot proceed | No |
| Warning | System proceeds with degraded behavior | Yes |
| Instruction | Navigation guidance — informs without blocking | Yes, auto-dismisses on action |

**Visual language:** Edges undefined, surface flickering between materialized and void, emitting unstable violet-white light. Severity determines intensity — blocking gaps flicker fully, warning gaps pulse amber, instruction gaps emit soft neutral guidance glow.

---

## Port System

### Port Definition
```typescript
type PortType = 'text' | 'number' | 'boolean' | 'object' | 'array' | 'any';

interface Port {
  id: string;
  label: string;
  type: PortType;
  schema?: Record<string, PortType>;   // for object types
  required: boolean;
  direction: 'input' | 'output';
  sensitive: boolean;                   // true = values redacted in execution traces
}
```

### Secrets
Secrets (API keys, credentials, tokens) are not port values. They never flow through ports. They are managed through `CardSecretReference` and stored in the secrets store:

```typescript
interface CardSecretReference {
  secretKey: string;       // key in the secrets store
  requiredBy: string;      // card ID that needs this secret
  purpose: string;         // plain language — "OpenAI API key for this model"
}
```

### Typed Connections
Connecting an output port to an input port performs contract validation at connection time. Incompatible port types do not connect — ports reject each other visually. Type information propagates through the spine. When an upstream card's output schema changes, every downstream card that depends on it receives the update and responds.

---

## Card States

| State | Visual Signal | Meaning |
|-------|--------------|---------|
| idle | Soft neutral white-blue glow | Configured, connected, not executing |
| editing | Magnified surface, focused | User is actively editing |
| active | Warm amber luminescence | Currently processing in execution |
| passing | Deep teal-green pulse | Last eval passed or last execution succeeded |
| error | Red turbulence | Execution or compilation failure |
| sealed_error | Cold red pulse | Vercel deployment failure (Sealed state only) |
| affected | Amber cascade | Upstream change impacted this card, resolution pending |
| needs_resolution | Sustained amber | Suggestion rejected, manual resolution required |
| confirming | Slow amber pulse, bifurcated surface | Agent proposal awaiting user confirmation |
| sealed | Cold blue-white crystalline | System is Sealed, structural controls locked |
| unresolved | Unstable flickering violet-white | Gap Card — decision required |
| pending | Subtle pending indicator | Sealed state — PendingChange queued, not yet released |
| analysis | Slow distinct pulse | Impact analysis in progress (large spine) |

---

## The Ghost Trace System

Every execution leaves a ghost trace — a faint, transparent echo of the path it traveled, fading slowly behind the active state. The last several executions accumulate as layered ghosts.

Ghost traces are spatial memory, not a log. The user sees failure as red turbulence at the exact card where execution broke. The user sees hot paths as warmer sections of the spine that have been traveled many times. Failed execution ghost traces render in red turbulence color. Maximum 10 ghost traces rendered simultaneously per connection. Ghost traces older than 30 days are removed.
