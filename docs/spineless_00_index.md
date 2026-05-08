# Spineless — Document Index

**Version 2.1 | Source of Truth**

---

## What This Set Is

This is the complete source of truth for the Spineless pre-build documentation set. Every product decision, scope boundary, user experience detail, visual language specification, architectural constraint, and implementation spec is recorded here.

When there is a conflict between something said in conversation and something written here, this document set wins. When a new decision is made, it is recorded here before it is acted on anywhere else.

---

## Canonical Precedence

Document 11 defines the current highest-precedence product scope.

If document 11 conflicts with documents 00-10, document 11 controls.

Documents 08, 09, and 10 remain implementation context only where they do not conflict with document 11.

Documents 00-07 remain product, visual, and scope context where not superseded.

---

## Documents

### 01 — Product Definition

`spineless_01_product_definition.md`

What Spineless is. The problem it solves. The user it serves. The core mechanic. The output target. The state model. The agent model. What it is not. The name. **Start here.**

### 02 — The Card System

`spineless_02_card_system.md`

Earlier card-system implementation context. Superseded by document 11 where it assumes card-authored generation.

### 03 — The Spine & Visual Language

`spineless_03_spine_visual_language.md`

The spine's spatial logic. The scroll interaction model. Ribbon connections. The void. Material language. Lighting system. Color temperature encoding. Live and Sealed visual language. Execution animation.

### 04 — The Agent Model & Compilation

`spineless_04_agent_compilation.md`

Earlier agent and compilation context. Superseded by document 11 where it assumes generated application output.

### 05 — User Experience

`spineless_05_user_experience.md`

Complete end-to-end user experience from first open through ongoing operation. What the user never does.

### 06 — Scope Boundaries

`spineless_06_scope_boundaries.md`

What is in scope and out of scope for v1. Drift warning signs. The revision process.

### 07 — Architecture Contract

`spineless_07_architecture_contract.md`

Source of truth resolution. Canonical edit lifecycle state machines — Live and Sealed paths. Live, Seal, Sealed, Release defined. Deployment model. Persistence model. Eval Card runtime. Structured output model. System topology. Data contracts. Compilation pipeline. Execution lifecycle. Secrets and sandboxing. Failure and recovery. Sealed-state editing. Navigation at scale. First-run affordances.

### 08 — Implementation State & Interaction Spec

`spineless_08_implementation_spec.md`

Earlier implementation state and interaction context. Superseded by document 11 where it conflicts with the application-flow reframe.

### 09 — Contract Hardening

`spineless_09_contract_hardening.md`

LifecycleStage separated from CardState. PendingChange rebase rules. Prompt/Model execution semantics. Card creation gestures. Version locking. Telemetry redaction. Gap Card severity. Consolidated final type system. Implementation freeze checklist.

### 10 — Contract Hardening Precedence Layer

`spineless_10_contract_hardening.md`

Final hardening and precedence layer for Spineless v1 implementation. Document 10 is additive where non-conflicting and controlling where it conflicts with documents 08 or 09.

### 11 — Application Flow Reframe

`spineless_11_application_flow_reframe.md`

Highest-precedence scope update. Reframes the spine as the main frontend → middleware/API → backend application flow and maps supporting code as biological systems around it.

---

## Locked Decisions Summary

| Decision                   | Locked Value                                           |
| -------------------------- | ------------------------------------------------------ |
| User                       | Builder or engineer understanding an application codebase |
| Collaboration              | Out of scope, v1                                       |
| Entry point                | Existing application flow, identified from codebase structure |
| Source of truth            | The codebase is canonical; the Spineless spine is an interpretive flow map |
| Agent mutates              | Spine map and annotations only — never source files directly |
| Agent write model          | Analysis and confirmed map updates only                |
| Output target              | Application-flow understanding, not generated source   |
| State names                | To be redefined around analysis and map refinement     |
| Deployment                 | Not part of current pre-build scope                    |
| Rendering                  | Custom WebGL with GLSL shaders                         |
| Spatial grammar            | Scroll-driven vertical depth                           |
| Visual reference           | Active Theory spine component aesthetic                |
| Language scope             | Existing application codebases; language target not locked |
| Existing codebase analysis | In scope — focused on the main application flow        |
| Autonomous agent writes    | Permanently out of scope                               |
| Mobile                     | Out of scope                                           |
| Template library           | Out of scope, v1                                       |
| Code visibility for user   | In scope as referenced source context, not as an editing surface |
| Eval execution             | Superseded unless reintroduced for codebase analysis   |
| Card creation              | Superseded unless reintroduced for map authoring       |
| Multi-tab                  | Second tab read-only, v1                               |
| Secret model               | Secrets never enter port flow — CardSecretReference    |
| Sensitive data             | port.sensitive: boolean governs user data redaction    |

---

## Resolved / Deferred Decisions

| Decision                          | Status                                                                                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent model selection             | Provider choice deferred; v1 contracts remain implementation-ready and provider-agnostic                                                                    |
| Spineless hosting target          | Resolved by documents 08-10 for v1 implementation                                                                                                           |
| Spine state persistence mechanism | Behavioral contract resolved by documents 08-10. Implementation substrate (database provider) is provider-agnostic and deferred — not required for Phase 1. |
| Eval hook framework integration   | Resolved by documents 08-10 for v1 implementation                                                                                                           |
| Python second-phase scope         | Deferred to post-v1                                                                                                                                         |

---

_Spineless v2.1. May 2026._
