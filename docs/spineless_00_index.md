# Spineless — Document Index
**Version 2.0 | Source of Truth**

---

## What This Set Is

This is the complete, frozen source of truth for Spineless v1. Every product decision, scope boundary, user experience detail, visual language specification, architectural constraint, and implementation spec is recorded here. Nothing in these documents is aspirational or approximate. Every statement is a deliberate, locked decision.

When there is a conflict between something said in conversation and something written here, this document set wins. When a new decision is made, it is recorded here before it is acted on anywhere else.

---

## Canonical Precedence

Documents 08, 09, and 10 define the Spineless v1 implementation canon.

If documents 00-07 conflict with documents 08-10, documents 08-10 control.

If document 10 conflicts with documents 08 or 09, document 10 controls.

Documents 00-07 remain product, visual, and scope context. They are not implementation-authoritative where superseded by documents 08-10.

Document 10 is a hardening and precedence layer. It supersedes conflicting implementation details in documents 08 and 09.

---

## Documents

### 01 — Product Definition
`spineless_01_product_definition.md`

What Spineless is. The problem it solves. The user it serves. The core mechanic. The output target. The state model. The agent model. What it is not. The name. **Start here.**

### 02 — The Card System
`spineless_02_card_system.md`

Every card type defined in full. Card anatomy. Typed connections. Card states. The ghost trace system. How cards are authored, what they compile to, and how they behave under impact.

### 03 — The Spine & Visual Language
`spineless_03_spine_visual_language.md`

The spine's spatial logic. The scroll interaction model. Ribbon connections. The void. Material language. Lighting system. Color temperature encoding. Live and Sealed visual language. Execution animation.

### 04 — The Agent Model & Compilation
`spineless_04_agent_compilation.md`

The agent's trigger, context, proposal, and write cycle. Impact analysis. The compilation model. The Live / Sealed compilation boundary. The Gap Card as a system mechanism.

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

Complete state machine with Live and Sealed paths. CardState enum. MutationScope enforcement. Impact analysis budget. Eval middleware — fully async. Per-card authoring spec for all nine card types. Confirmation state specification. Minimap specification. Engineering acceptance criteria. Interaction behaviors.

### 09 — Contract Hardening
`spineless_09_contract_hardening.md`

LifecycleStage separated from CardState. PendingChange rebase rules. Prompt/Model execution semantics. Card creation gestures. Version locking. Telemetry redaction. Gap Card severity. Consolidated final type system. Implementation freeze checklist.

### 10 — Contract Hardening Precedence Layer
`spineless_10_contract_hardening.md`

Final hardening and precedence layer for Spineless v1 implementation. Document 10 is additive where non-conflicting and controlling where it conflicts with documents 08 or 09.

---

## Locked Decisions Summary

| Decision | Locked Value |
|----------|-------------|
| User | Solo prompt engineer, not a coder |
| Collaboration | Out of scope, v1 |
| Entry point | Empty spine, Input Card, user authors from scratch |
| Source of truth | Spine graph canonical. Files are compiled output. |
| Agent mutates | Spine state only — never source files directly |
| Agent write model | Autonomous reasoning, confirmed writing only |
| Output target | Next.js / TypeScript |
| State names | Live and Sealed |
| Deployment | Vercel via Spineless-managed API |
| Rendering | Custom WebGL with GLSL shaders |
| Spatial grammar | Scroll-driven vertical depth |
| Visual reference | Active Theory spine component aesthetic |
| Language scope | JavaScript / TypeScript primary. Python deferred. |
| Existing codebase analysis | Out of scope, v1 |
| Autonomous agent writes | Permanently out of scope |
| Mobile | Out of scope |
| Template library | Out of scope, v1 |
| Code visibility for user | Out of scope |
| Eval execution | Fully async, zero execution chain latency |
| Card creation | Port label affordance and drag-to-void, both canonical |
| Multi-tab | Second tab read-only, v1 |
| Secret model | Secrets never enter port flow — CardSecretReference |
| Sensitive data | port.sensitive: boolean governs user data redaction |

---

## Resolved / Deferred Decisions

| Decision | Status |
|----------|--------|
| Agent model selection | Provider choice deferred; v1 contracts remain implementation-ready and provider-agnostic |
| Spineless hosting target | Resolved by documents 08-10 for v1 implementation |
| Spine state persistence mechanism | Resolved by documents 08-10 for v1 implementation |
| Eval hook framework integration | Resolved by documents 08-10 for v1 implementation |
| Python second-phase scope | Deferred to post-v1 |

---

*Spineless v2.0. April 2026.*
