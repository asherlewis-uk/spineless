# Spineless — Application Flow Reframe

**Version 2.1 | Highest Precedence Scope Update**

---

## Purpose

This document updates the pre-implementation product scope for Spineless. It supersedes earlier assumptions that a whole codebase should be represented as one long, linear spine.

Spineless now treats the **main application flow** as the spine: the central route a request, user interaction, or feature execution travels through the application stack.

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

The rest of the codebase is not forced into that vertical path. Supporting systems attach to, protect, inform, or move through the spine.

---

## Precedence

This document is the highest-precedence document in the Spineless pre-implementation documentation set.

- Document 11 supersedes documents 00-10 wherever they conflict.
- Documents 08-10 remain useful implementation context only where they do not conflict with this reframe.
- Precedence is determined by document number, not by this document's version number.
- Any statement that treats the entire codebase as a single linear spine is superseded.
- Any statement that places existing codebase analysis out of scope is superseded.

---

## Updated Product Definition

Spineless is a visual, scroll-based environment for identifying and understanding the structural spine of an application codebase.

It does not flatten the entire repository into one sequence. It identifies the core vertical path through the application stack, then maps the surrounding systems that make that path work.

The spine is therefore:

```text
Frontend
  ↓
Middleware
  ↓
Backend
```

Expanded in product terms:

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

This is the central structure of the application. It is the path a request, interaction, or piece of functionality travels through.

---

## Biological Systems Model

Supporting code is mapped as biological systems around the spine, not as additional spine segments.

| Anatomy metaphor | Software equivalent |
| --- | --- |
| **Spine** | Main frontend → middleware → backend flow |
| **Nervous system** | Events, signals, state changes, user interactions |
| **Circulatory system** | Data flow, API calls, database reads/writes, caching |
| **Skeleton** | Project structure, routing, schemas, architecture |
| **Muscles** | Business logic, services, functions that perform work |
| **Organs** | Major features, modules, or domains |
| **Skin** | UI, styling, presentation layer |
| **Immune system** | Authentication, validation, permissions, error handling, security |
| **Brain / memory** | State management, database, configuration, decision-making logic |

These systems can intersect the spine at many points. They may run alongside it, wrap it, protect it, or feed it. They are not required to be rendered as a single downward execution chain.

---

## What Changes Conceptually

### The spine is the main stack flow

The spine is the primary vertical route through the application. It should answer:

- Where does the interaction enter?
- What frontend surface receives it?
- What middleware, route, or API boundary handles it?
- What backend service performs the work?
- What database, cache, queue, or external system is reached?
- Where does the response or result return?

### The whole codebase is not the spine

Real applications are layered, connected, and interdependent. Spineless should not make every file, module, service, helper, schema, and utility compete for position in the central vertical path.

Instead:

- Core request / interaction flow belongs on the spine.
- Cross-cutting concerns become supporting systems.
- Feature domains become organs attached to relevant spine sections.
- Auth, validation, permissions, and error handling become immune-system overlays.
- State, persistence, and configuration become brain / memory systems.

### Supporting systems remain first-class

Supporting systems are not secondary in importance. They are secondary only in spatial grammar. Spineless must show how they connect to the spine, where they influence behavior, and which parts of the core flow depend on them.

---

## Updated Scope

### In Scope

- Identifying the main application-flow spine of an existing codebase.
- Mapping frontend, middleware/API, backend, and persistence/external-system boundaries.
- Describing surrounding biological systems that support the spine.
- Showing where supporting systems intersect the main flow.
- Preserving the scroll-based vertical spine as the central navigation model.
- Avoiding a misleading one-dimensional representation of the whole repository.

### Out of Scope

- Treating every file or module as a spine segment.
- Forcing unrelated subsystems into a single linear path.
- Presenting the repository as a generic dependency graph without a central application flow.
- Treating cross-cutting systems such as auth, logging, validation, caching, and state management as merely downstream spine nodes.

---

## Implementation Implications

Future implementation work should start from codebase structure and runtime flow discovery rather than card-authored generation.

The product model should distinguish:

- **Spine nodes:** the main flow stages of the application stack.
- **System overlays:** biological systems that interact with the spine.
- **Attachment points:** places where an overlay affects, protects, feeds, or observes the spine.
- **Feature organs:** major modules or domains connected to one or more flow stages.

Generated source code, card-authored compilation, and Next.js-only output remain superseded wherever they conflict with this reframe. They may inform future interaction patterns, but they are not the current product scope.

---

## Acceptance Principle

A Spineless view is correct when a user can understand the main path through the application without losing sight of the supporting systems that keep that path functional.

The product should make the central flow legible without pretending the rest of the codebase is linear.
