# Spineless — Scope Boundaries
**Version 2.1 | Source of Truth**

---

## Purpose

This document exists to prevent drift. Every item listed here is a deliberate decision about what Spineless is and is not in v1. These decisions are not temporary omissions or features that fell off the roadmap. They are intentional scope constraints that define what Spineless is.

When a new idea surfaces — from any source — evaluate it against this document first.

---

## In Scope — v1

### The Application-Flow Spine
Scroll-driven, vertically arranged, depth-aware representation of the main frontend → middleware/API → backend flow. The spine identifies the central path a request, interaction, or feature execution travels through.

### Biological System Mapping
Supporting systems around the spine: events and signals, data flow, project structure, business logic, feature domains, UI/styling, authentication, validation, permissions, error handling, security, state, persistence, configuration, and decision-making logic.

### Existing Codebase Analysis
Identifying the structural spine of an existing codebase. The goal is not to linearize the whole repository; it is to identify the main application flow and show how surrounding systems interact with it.

### Map Elements
Spine nodes, biological-system overlays, attachment points, feature organs, and source references. Earlier card-system details are retained only as historical interaction context where they do not conflict with document 11.

### The Agent
Full codebase and map context on every invocation. Map update proposals only — never direct file mutations. Confirmed updates only. Unresolvable structural questions surface as explicit gaps in the map.

### Source Context
Source files may be referenced as evidence for the spine and biological-system map. The current pre-build scope is understanding and mapping, not direct source mutation.

### State Model
Analysis and refinement states for discovering, reviewing, and confirming the application-flow map. Earlier Live / Sealed production states are superseded where they assume compilation or deployment.

### Deployment
Deployment is not part of the current pre-build scope. The product maps existing application structure; it does not deploy generated output.

### User
Solo builder or engineer. Single user per system in v1.

---

## Out of Scope — v1

### Collaboration
Real-time multiplayer editing, shared cursors, concurrent card editing. **Not in v1.** The intended audience is a solo developer.

### Whole-Codebase Linearization
Treating every file, module, helper, schema, utility, and dependency as part of one long vertical spine. **Not in scope.** The spine is the main application flow; surrounding code belongs to supporting biological systems.

### Template Library
A gallery of pre-built system templates. **Not in v1.** Spineless starts from an existing application codebase and identifies its structure.

### Parser Card
A dedicated card type for complex output parsing — regex extraction, multi-step transformation, format conversion. **Not in v1.** Earlier card-type assumptions are superseded by document 11 where they conflict with codebase mapping.

### Python Compilation Target
Python as a generated output target. **Not in v1.** The current scope is source analysis and application-flow mapping, not code generation.

### Direct Source Editing
Editing application source files from Spineless. **Not in scope for the pre-build documentation state.** Spineless maps and explains source structure; it does not mutate source.

### Generated Application Output
Generating a new application codebase from the spine. **Superseded by document 11.** The current scope starts from an existing codebase and identifies its structural flow.

### Version History UI
A visual interface for browsing and restoring previous spine states. Ghost traces provide spatial execution memory. Sealed releases provide production checkpoints. A full version history browser is **not in v1.**

### Natural Language System Generation
Describing a system in natural language and having Spineless generate a new application or initial authored spine. **Not in v1.** Spineless identifies the spine from existing application structure.

### Mobile
Spineless is a desktop product. **Not in scope.**

### Autonomous Agent Writes
An agent that writes to source without user confirmation. **Permanently out of scope** — not a deferred feature.

---

## Drift Warning Signs

The following are signals that a proposal or conversation has drifted from Spineless's defined scope:

- "What if every file were a node on the spine?"
- "What if we added a template gallery?"
- "What if we made it collaborative?"
- "What if the agent just handled it automatically?"
- "What if auth, logging, validation, and caching were just downstream spine nodes?"
- "What if Spineless generated a new app from the map?"
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
