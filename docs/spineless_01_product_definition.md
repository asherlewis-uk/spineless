# Spineless — Product Definition
**Version 2.1 | Source of Truth**

---

## What Spineless Is

Spineless is a visual, scroll-based environment for understanding the main application flow of a codebase.

The spine is no longer the whole codebase forced into a single linear chain. The spine is the central route an interaction, request, or feature execution travels through the application stack:

```text
User interaction
  ↓
Frontend UI
  ↓
Middleware / API layer
  ↓
Backend services
  ↓
Database / external systems
```

The codebase remains the implementation source of truth. Spineless provides an interpretive spine map of the core flow and the supporting systems that attach to it.

---

## The Problem It Solves

Real codebases are rarely perfectly linear. They are layered, connected, and interdependent.

Existing code views expose files, directories, imports, and dependency graphs, but they rarely answer the core structural question directly: what is the main path through the application, and which systems support it?

Spineless solves this by separating the central application-flow spine from the surrounding biological systems that keep it functioning.

The user should not have to pretend every file belongs on one vertical execution path. The product identifies the spine, then maps auth, logging, validation, caching, state, persistence, UI, services, domains, and events around it.

---

## The User

**Solo builders and engineers** who need to understand an application codebase structurally.

They understand that applications have a main path and supporting systems, but need a visual model that makes those relationships legible.

They do not want a flat file tree, a generic graph, or a misleading single-line representation of the whole repository.

Collaboration is out of scope for v1. Spineless is built for a single user operating their own system.

---

## The Core Mechanic

Spineless identifies the core application-flow spine, then maps supporting biological systems around it.

The spine is the vertical flow:

```text
Frontend
  ↓
Middleware
  ↓
Backend
```

Supporting systems are represented as surrounding layers:

- nervous system — events, signals, state changes, user interactions
- circulatory system — data flow, API calls, database reads/writes, caching
- skeleton — project structure, routing, schemas, architecture
- muscles — business logic, services, functions
- organs — major features, modules, domains
- skin — UI, styling, presentation
- immune system — authentication, validation, permissions, error handling, security
- brain / memory — state management, database, configuration, decision-making logic

Complexity stays visible because the product distinguishes central flow from supporting structure.

---

## The Output Target

Spineless' pre-build output is an application-flow understanding layer: a spine map plus biological-system overlays.

Earlier generated-code and Next.js-only compilation assumptions are superseded where they conflict with this scope. Future implementation work should begin from codebase analysis and flow discovery.

---

## The State Model

Spineless' previous Live / Sealed production state model is superseded where it assumes card-authored compilation and deployment. The current pre-build scope needs states around analysis and confirmed map refinement.

### Analysis
The codebase is inspected, entry points are identified, and the main application-flow spine is proposed. Supporting systems are discovered and attached to relevant spine sections.

### Refinement
The user reviews the proposed spine and supporting-system map. Confirmed changes update the map and annotations, not source files.

The user always knows whether Spineless is discovering structure, presenting a proposed map, or applying confirmed map refinements.

---

## The Agent Model

When a user asks Spineless to analyze or refine a view, an agent receives codebase context, discovered flow information, and the current spine map. It reasons about how the map should change.

**Autonomous reasoning. Confirmed writing.**

The agent proposes semantic updates to the spine map and supporting-system annotations — not direct source-file mutations. The user confirms any map-changing operation.

The agent understands the whole application before proposing anything. No narrow, file-scoped guesses. Every proposal is the result of system-wide reasoning about the core flow and its supporting systems.

---

## What Spineless Is Not

| Not This | Why |
|----------|-----|
| A generic dependency graph | Spineless centers the main application flow, not every relationship equally. |
| A whole-repo linearization tool | The entire codebase is not the spine. |
| A code editor | Source may be referenced, but Spineless does not make direct source edits. |
| A no-code template generator | The current scope is understanding existing application structure. |
| A prompt playground | Spineless models application flow, not single-shot completions. |
| A collaborative tool | v1 remains single user. Collaboration is not in scope. |
| An autonomous coding agent | The agent reasons autonomously, but confirmed changes affect the map, not source files. |

---

## The Name

Spineless subverts the expectation. The product identifies a structural spine without pretending the whole body is a spine. It makes the application feel biological: central flow, supporting systems, organs, skin, memory, immunity, and circulation working together.
