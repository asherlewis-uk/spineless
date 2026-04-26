# Spineless — The Spine & Visual Language
**Version 2.0 | Source of Truth**

---

## The Spine

The spine is the central structure of Spineless. It is a vertically scrolling, depth-aware arrangement of cards connected by ribbon connections. It has directionality — data flows downward. It has memory — execution history is visible as ghost traces. It has state — the entire spine shifts its visual language when the system moves between Live and Sealed.

The spine is not a canvas. The user does not drag cards onto a 2D surface and draw connections between them. The spine arranges itself in execution order based on the connections the user authors. The user's job is to author cards and define relationships. The spine's job is to make the resulting system legible.

---

## Spatial Logic

The spine uses **scroll-driven depth** as its primary spatial grammar — the same logic Active Theory's spine component uses.

- **Scroll position = execution depth.** The further down the spine, the later in the execution chain.
- **Branching = parallel depth tracks.** When a Logic Card branches, both paths continue downward in parallel, side by side, rejoining at a merge point.
- **Z-depth = abstraction level.** Cards exist at slightly different distances from the viewer based on their role. Entry points sit closest. Deep chain elements recede slightly. This creates natural parallax as the user scrolls.
- **Zoom = inspection level.** Scrolling vertically moves through the system. Zooming into any card magnifies its surface for direct interaction. Zooming out reveals the full system overview.

When a system grows complex, it scrolls deeper. It does not widen. Complexity is managed through depth, not sprawl.

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
