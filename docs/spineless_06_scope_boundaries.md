# Spineless — Scope Boundaries
**Version 2.0 | Source of Truth**

---

## Purpose

This document exists to prevent drift. Every item listed here is a deliberate decision about what Spineless is and is not in v1. These decisions are not temporary omissions or features that fell off the roadmap. They are intentional scope constraints that define what Spineless is.

When a new idea surfaces — from any source — evaluate it against this document first.

---

## In Scope — v1

### The Spine
Scroll-driven, vertically arranged, depth-aware card spine. Custom WebGL rendering with GLSL shaders. Glassmorphic card surfaces with state-driven lighting. Bézier ribbon connections with particle streams. Ghost trace system for execution history. Impact analysis on every card edit. Gap Card system for unresolved decisions. Minimap navigation. Pinch overview.

### The Card System
Input Card, Prompt Card, Model Card, Tool Card, Memory Card, Logic Card, Output Card, Eval Card, Gap Card (system-generated).

### The Agent
Full system context on every invocation. Spine mutation proposals only — never direct file mutations. Proposal surfaced as confirmation state on the triggering card. Confirmed writing only. Gap Card generation on unresolvable proposals. MutationScope enforcement — structural proposals in Sealed state become Gap Cards.

### Compilation
Next.js / TypeScript output target. Continuous compilation on every confirmed change in Live state. Queued compilation on Release in Sealed state. Deterministic — same spine state always produces same files.

### State Model
Live state — fully editable, continuous compilation, Live runtime sandbox. Sealed state — locked to release cycle, confirmational changes queue. Seal action — promotes Live to production Vercel deployment. Release action — validates/rebases queued changes, applies included entries to the current Sealed snapshot graph to produce the next snapshot, pushes new Vercel deployment, and remains Sealed. Return to Live — pending queue preserved.

### Deployment
Vercel via Spineless-managed API. One-time OAuth connection. Automatic on every Seal and Release. Production URL surfaces on Output Card. User never touches Vercel directly.

### User
Solo prompt engineer. Single user per system in v1.

---

## Out of Scope — v1

### Collaboration
Real-time multiplayer editing, shared cursors, concurrent card editing. **Not in v1.** The intended audience is a solo developer.

### Existing Codebase Analysis
Pointing Spineless at an existing repo and generating a spine from it. **Not in v1.** Spineless prevents complexity from accumulating. Rescuing existing complexity is a different product.

### Template Library
A gallery of pre-built system templates. **Not in v1.** Every system begins with an Input Card. The user authors from intent.

### Parser Card
A dedicated card type for complex output parsing — regex extraction, multi-step transformation, format conversion. **Not in v1.** Any earlier Parser Card reference is superseded. Structured output in v1 is handled by Prompt Card declared output schema plus Model Card structured-output enforcement. Parser Card may be considered only as a future, post-v1 possibility.

### Python Compilation Target
Python as a second output target for AI tooling code. **Not in v1.** Acknowledged as a natural second phase.

### Code Visibility
Any surface that shows the user their generated source code. **Not in v1.** The spine is the interface. The code is infrastructure.

### Export to Code
A feature that exports the generated codebase as an editable project. **Not in v1.** The generated code is not for the user.

### Version History UI
A visual interface for browsing and restoring previous spine states. Ghost traces provide spatial execution memory. Sealed releases provide production checkpoints. A full version history browser is **not in v1.**

### Natural Language System Generation
Describing a system in natural language and having Spineless generate the initial spine. **Not in v1.** The user authors cards directly.

### Mobile
Spineless is a desktop product. **Not in scope.**

### Autonomous Agent Writes
An agent that writes to source without user confirmation. **Permanently out of scope** — not a deferred feature.

---

## Drift Warning Signs

The following are signals that a proposal or conversation has drifted from Spineless's defined scope:

- "What if the user could import an existing project?"
- "What if we added a template gallery?"
- "What if we made it collaborative?"
- "What if the agent just handled it automatically?"
- "What if we showed the user the generated code?"
- "What if we supported Python too?"
- "What if we added a mobile view?"
- "What if we added a Parser Card?"

Each of these is a valid idea for a future product or phase. None of them is Spineless v1.

---

## Revision Process

Changes to scope require:
1. Identifying the specific item being added, removed, or modified
2. Stating explicitly what in-scope item it interacts with or replaces
3. Evaluating whether the change expands, contracts, or redirects scope
4. Updating this document with the revision and the reasoning

Changes to this document are changes to the product.
