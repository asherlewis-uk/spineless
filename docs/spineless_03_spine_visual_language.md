# Spineless — The Spine & Visual Language
**Version 2.1 | Source of Truth**

---

## The Spine

The spine is the central application flow of Spineless. It is a vertically scrolling, depth-aware arrangement of the main frontend → middleware/API → backend path. It has directionality — requests, interactions, and data move downward through the application stack.

The spine is not the whole codebase. Supporting systems appear around and through it as biological overlays, attachments, and contextual layers. The spine's job is to make the main application route legible without hiding the systems that support it.

---

## Spatial Logic

The spine uses **scroll-driven depth** as its primary spatial grammar — the same logic Active Theory's spine component uses.

- **Scroll position = application-flow depth.** The further down the spine, the later in the frontend → middleware/API → backend path.
- **Branching = alternate request or feature paths.** Branches represent real alternate flows, not unrelated repository areas.
- **Z-depth = system relationship.** The central spine stays closest. Supporting systems sit around it at contextual depth based on how they interact with the flow.
- **Zoom = inspection level.** Scrolling vertically moves through the main flow. Zooming into a section reveals the supporting biological systems attached there.

When a codebase grows complex, the central spine remains legible. Complexity is managed by separating the main flow from surrounding systems, not by forcing every component into one vertical line.

---

## Biological System Layers

Supporting code is visualized as systems around the spine:

| Anatomy metaphor | Visual role |
| --- | --- |
| Spine | Central vertical application flow |
| Nervous system | Event and interaction signals firing into spine sections |
| Circulatory system | Data movement, API calls, database reads/writes, cache paths |
| Skeleton | Routes, schemas, directories, architectural structure |
| Muscles | Services and functions that perform work at each section |
| Organs | Feature domains attached to the spine where they execute |
| Skin | UI and styling surfaces closest to the user-facing entry points |
| Immune system | Auth, validation, permissions, errors, and security wrappers |
| Brain / memory | State, persistence, configuration, and decision-making systems |

These systems can be inspected without being mistaken for the spine itself.

---

## The Ribbon Connections

Connections between cards are ribbons of light — not lines, not wires, but physically present bézier curves with perceivable width and translucency.

- **Width encodes relationship strength.** Primary data flow is a wide ribbon. Conditional or secondary dependencies are narrower.
- **Luminescence encodes health.** Healthy connections glow with soft neutral light. Broken connections spark and dim. Affected connections pulse amber.
- **Particle streams travel along ribbons** in the direction of data flow — downward through the spine. Particle density and speed encode execution load.
- **Ribbons through Eval Cards** change character — the ribbon passes through the card like a valve. Green luminescence when passing. Red turbulence when failing.

---

## The Visual Language

### Material
All surfaces are glassmorphic. Translucent, physically thick, light refracting through edges. Cards have perceivable depth and weight — they exist in genuine 3D space.

Card edges carry a subtle glitch quality — reality flickering at the boundary, as though the card exists at the edge of materialization. This is most pronounced on Gap Cards and during the confirming state. Frost and crystalline textures appear only in the Sealed state.

### Lighting
All light is emitted from within UI elements. The void is lit entirely by the system itself. No external light sources exist. Color temperature encodes state consistently across the entire system:

| Temperature | Color | State |
|-------------|-------|-------|
| Warm amber-orange | `#BA7517` → `#EF9F27` | Active, processing |
| Deep teal-green | `#0F6E56` → `#1D9E75` | Healthy, passing |
| Soft neutral white-blue | `#B5D4F4` → `#E6F1FB` | Idle |
| Cold blue-white crystalline | `#85B7EB` → `#E6F1FB` | Sealed |
| Red turbulence | `#A32D2D` → `#E24B4A` | Error, failing |
| Amber cascade | `#BA7517` → `#FAC775` | Affected, warning |
| Unstable violet-white | `#7F77DD` → `#EEEDFE` | Unresolved, Gap |
| Transparent white fading | — | Ghost traces |

This encoding is immutable. These colors mean these states everywhere in Spineless, always.

### The Void
A near-black environment with subtle organic ambient drift — breathing, not static. Biomechanical undertones. The void is lit only by the system within it. The void never has floors, walls, ceilings, external light sources, smoke, fog, atmospheric haze, or UI chrome.

### Typography
Minimal, clean, sans-serif. Text floats at a slightly different depth than the card surface. Never decorative. Content only.

---

## Live State Visual Language

- Cards emit warm or neutral inner light based on current activity
- Particle streams flow continuously along ribbons at resting pace
- Executing cards flare to full amber luminescence as they process
- Ghost traces fade slowly behind active executions
- The void breathes with subtle ambient drift
- The spine feels alive, directional, and in motion

---

## Sealed State Visual Language

When the system moves to Sealed, the crystallization wave travels down the spine from Input Card to Output Card — cold blue-white spreading through each section as it passes:

- Glass becomes ice — surfaces shift to cold blue-white with frost at card edges
- Particle streams slow to near stillness — present but suspended
- Ribbon connections become rigid and bright rather than fluid
- Cards remain readable and interactable — confirmational changes surface as proposals that queue for the next release
- The void dims slightly — the system is preserved, not dead

---

## Execution Animation

1. Input Card flares white — particle streams surge downward
2. Each card the execution touches activates sequentially as data arrives
3. Model Card glows amber and pulses with latency heat while waiting for LLM response
4. Particle streams slow through the Model Card — the bottleneck is visible
5. Response arrives — particles accelerate through downstream cards
6. Logic Card evaluates — one branch brightens, the other dims
7. Output Card receives result — surfaces on the card face
8. Execution ghost begins fading — transparent echo of the path settles into spine memory

---

## Scroll Interaction Model

- **Slow scroll** — spine moves deliberately, each section revealing cleanly
- **Fast scroll** — spine flows with momentum, settling when scroll stops
- **Click card in overview** — snaps spine to that card at full zoom
- **Pinch to zoom out** — full system overview, all cards visible simultaneously
- **Zoom into card** — magnifies card surface for direct editing and interaction

---

## Navigation at Scale

### Section Labels
Every Logic Card branch creates a named section. The section label floats at the branching point and remains visible as a scroll anchor.

### Minimap
A fixed 12px wide element at the right edge of the viewport. Full viewport height. Each card is a colored segment proportional to its scroll height. Segment color encodes card state. Clicking any segment snaps scroll to that card. Hovering shows a tooltip with card type and name.

**Card type colors in idle state (minimap only):**

| Card Type | Idle Color |
|-----------|-----------|
| Input | `#1D9E75` teal |
| Prompt | `#7F77DD` purple |
| Model | `#BA7517` amber |
| Tool | `#D85A30` coral |
| Memory | `#378ADD` blue |
| Logic | `#888780` gray |
| Output | `#1D9E75` teal |
| Eval | `#639922` green |
| Gap | `#7F77DD` purple flickering |

### Pinch Overview
Pinching to full overview renders all cards at reduced size. Types and states are visible by color. Clicking any card in overview snaps to that card at full zoom.

### Failure Navigation
When an execution fails, the spine automatically scrolls to the failed card.

### Affected Card Navigation
When impact analysis surfaces affected cards that are off-screen, a count indicator appears at the scroll direction toward them. Clicking scrolls to the nearest affected card.
