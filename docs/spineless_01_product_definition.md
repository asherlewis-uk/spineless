# Spineless — Product Definition
**Version 2.0 | Source of Truth**

---

## What Spineless Is

Spineless is a visual, scroll-based environment where prompt engineers build full-stack AI systems. It analyzes nothing and starts from nothing — the user authors their system through cards, the spine grows as they build, and the source code is the compiled output of that spine.

The spine is not a diagram of the system. The spine is the system.

The spine graph is the single source of truth. Cards and connections live in that graph. Files are derived artifacts. The user never touches source directly, never manages a codebase, and never accumulates complexity they cannot see. The spine holds all complexity visibly, spatially, and manageably — from the first card to the last.

---

## The Problem It Solves

Prompt engineers can design full-stack AI systems in their heads, in conversation, in documents. They understand how prompts chain, how models should be configured, how tools connect, how memory should behave, how outputs should be validated.

They cannot make those systems real without writing code. And when they hand off to engineers, something is always lost in translation.

Existing options force a choice between two failures:

- **Learn to code** — high friction, high error rate, abandonment
- **Use no-code tools** — black boxes, no debuggability, no real control

Spineless sits between these. The logic is fully visible and manipulable. The code is never written by the user. The system is real, deployed, and running — authored entirely through the spine.

---

## The User

**Solo prompt engineers** who can architect full-stack AI systems but do not write code fluently.

They understand: prompt structure and chaining, LLM behavior and parameters, tool use and function calling, RAG, memory, and retrieval, system inputs, outputs, and validation, how AI systems should behave end to end.

They do not manage: TypeScript, imports, or package dependencies, API routes, middleware, or auth, deployment configuration or infrastructure, Git, CI/CD, or environment management.

Collaboration is out of scope for v1. Spineless is built for a single user operating their own system.

---

## The Core Mechanic

The user authors cards. Cards compose into a spine. The spine compiles to a running Next.js / TypeScript system.

Every card represents a real, functional system component. Every connection between cards is a typed, validated relationship. Every edit to a card triggers system-wide impact analysis. Every proposed change is confirmed before it affects the system: in Live state, confirmation mutates the active spine graph; in Sealed state, confirmation appends a PendingChange to the queue without mutating the current SealedSnapshot.

The spine grows with the system. Complexity never outpaces visibility because visibility is where the work happens.

---

## The Output Target

Spineless generates **Next.js / TypeScript** as its output surface. This is the initial and primary compilation target. Python is a natural second-phase target for AI tooling code specifically — deferred to post-v1.

The generated code is not for the user to read or edit. It is a byproduct of decisions made in the spine. The user operates the spine. The spine produces the system.

---

## The State Model

Spineless has two explicit states with a hard boundary between them.

### Live
The working state. The spine is active, editable, and responsive. Cards can be authored, connected, and reconfigured. Confirmed Live mutations update the spine graph, the compiler runs deterministically, and the Live Runtime Sandbox updates. Particle streams flow. Cards glow with activity.

### Sealed
The production state. The spine is crystallized. The system runs against a locked snapshot on Vercel. The spine remains visible and interactable — confirmational changes are allowed and queue for the next release cycle. No free structural editing. No immediate writes to production. The visual language shifts: cold blue-white, crystalline surfaces, slowed particle streams.

The user always knows which state they are in. The boundary is explicit, visible, and deliberate.

---

## The Agent Model

When a user reconfigures or edits a card, a local AI agent receives full system context — the entire spine graph, the complete dependency graph, the full generated codebase state — and reasons about what needs to change in the spine to reflect that intent.

**Autonomous reasoning. Confirmed writing.**

The agent proposes a semantic spine mutation — not a file mutation. Spineless surfaces the proposal as a confirmation state directly on the card that triggered it. The user confirms.

In Live state, the spine graph mutates, the compiler runs deterministically from the updated spine state, and the Live Runtime Sandbox updates.

In Sealed state, a PendingChange is appended to the queue. The current SealedSnapshot is not mutated, compilation does not run, and deployment does not occur until Release.

The agent understands the whole system before proposing anything. No narrow, card-scoped edits. No local guesses. Every proposal is the result of system-wide reasoning.

---

## What Spineless Is Not

| Not This | Why |
|----------|-----|
| A diagram tool | The spine executes. It does not represent. |
| A code editor | The user never sees or touches source directly. |
| A no-code template generator | Cards are authored, not selected from a library. |
| A prompt playground | Spineless builds systems, not single-shot completions. |
| A rescue tool for existing codebases | Spineless prevents complexity from accumulating, not recovers from it. |
| A collaborative tool | v1 is single user. Collaboration is not in scope. |
| Language agnostic | Next.js / TypeScript is the initial and primary target. |
| An autonomous agent | The agent reasons autonomously. It writes only on confirmation. |

---

## The Name

Spineless subverts the expectation. Active Theory's Spine implies rigid structure. Spineless implies fluid, adaptive, organic growth. The tool bends to how the user thinks — not to how code is structured. The system has no rigid backbone. It grows as the user grows it.
