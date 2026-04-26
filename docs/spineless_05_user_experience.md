# Spineless — User Experience
**Version 2.0 | Source of Truth**

---

## First Open

The user opens Spineless. No project setup, no configuration wizard, no template selection, no onboarding flow.

The screen is a near-black void with subtle organic ambient drift — breathing, alive. A single Input Card floats at the top of the spine position — unconfigured, soft neutral inner glow. This is the origin point. This is where every system begins.

The user does not describe their system to an AI and watch it generate. They author it, card by card, connection by connection, from this first Input Card forward.

---

## Authoring the First Card

The user zooms into the Input Card. The glass surface magnifies. The card face shows its empty state:

```
Input Card
─────────────────────────────
What enters your system?

[ Text  ▾ ]  Name this input

+ Add field
─────────────────────────────
```

The user defines what enters the system: data type, field name, validation rules. As they configure, output ports materialize on the card's right edge — typed, labeled, ready to connect. Once at least one field is configured, the port label appears: "Connect to a Prompt →"

---

## Creating the Next Card

Two gestures, both canonical:

**Port label (guided):** The user clicks "Connect to a Prompt →" on the Input Card's output port. A Prompt Card materializes immediately below, connected automatically. The new card enters editing state.

**Drag to void (experienced):** The user drags from the output port into empty spine space. A ribbon of light trails the cursor. On release, an inline card picker opens at the drop point showing only compatible downstream card types. The user selects Prompt Card. It creates and connects automatically.

---

## Growing the Spine

The user zooms into the Prompt Card and writes the prompt text. They highlight `{ticket_text}` — it immediately becomes a bound variable, glowing blue at the point of binding, already wired to the Input Card's output. No schema definition required.

They define the output schema — adding fields: `urgency_score: number`, `sentiment: text`, `category: text`. Each field becomes a typed output port, declared on the Prompt Card but carried at runtime by the connected Model Card.

They add a Model Card. Wire it to the Prompt Card. Select GPT-4. Set temperature to 0.2. The card shows cost-per-run and context window fit immediately. JSON mode auto-enables because the Prompt Card has a defined output schema.

They add a Logic Card. Wire it to the Model Card's output. Define the condition: `if urgency_score > 3`. The condition uses `urgency_score` — a variable that exists in the Model Card's output. The Logic Card recognizes it. The condition is valid.

Two branches extend downward from the Logic Card. The user continues down each path, adding Prompt Cards, Output Cards, wiring them. The spine grows. Each card is real. Each connection is typed. Each section is legible as it forms.

---

## Editing a Card

The user edits the Prompt Card — changes "calm/frustrated/angry" in the output schema to "satisfied/concerned/frustrated/irate". As they type:

The Logic Card downstream **pulses amber immediately**. Its condition was based on "angry", which no longer exists. A resolution suggestion surfaces on the Logic Card face: *"Update branch condition to 'irate'?"*

The user clicks **Accept**. The Logic Card updates. The amber fades to neutral.

The user commits the Prompt Card edit. The agent receives full system context, proposes a `SpineMutationProposal`. The Prompt Card enters `confirming` state — bifurcated into current and proposed depth layers. The confirmation panel shows:

```
This prompt now classifies tickets into four sentiment
categories instead of three.

Also affects:
• Logic Card — branch condition updated to 'irate'
• Eval Card — baseline may need updating

[ Confirm ]    [ Reject ]
```

The user confirms. Spine mutates. Compiler runs. Live runtime updates. Ghost trace emits through the changed path.

---

## Adding an Eval Card

The user sees the connection between the Draft Prompt Card and the Output Card — no quality check. They right-click the ribbon. A radial surfaces. They select **Wrap with Eval**.

An Eval Card grows into the ribbon at that point. The card asks: *"What does good look like here?"*

The user pastes three example input/output pairs onto the card face. The card absorbs them — *"3 examples learned"*. The agent injects the async eval middleware at the correct location. The card turns teal-green. Eval begins running against every future execution asynchronously — zero latency added to the execution chain.

---

## Executing

The user triggers an execution with test data. The spine comes alive.

The Input Card flares white. Particle streams surge to the Prompt Card — it activates amber. The Model Card receives the prompt — particle streams slow as latency builds, the card glowing with heat.

The response arrives. Particle streams accelerate. The Logic Card evaluates — `urgency_score: 4`, above threshold — one branch brightens, the other dims. Execution continues down the active path.

The Output Card receives the final result. It surfaces on the card face. Cost visible on the Model Card. The execution ghost begins fading — a transparent echo of the path settling into spine memory.

The Eval Card result arrives asynchronously moments later — the ribbon pulses teal-green. The user watched the whole thing without opening a single panel.

---

## Sealing the System

The system is built, tested, Eval Cards passing. The user triggers **Seal**.

The crystallization wave travels down the spine — cold blue-white spreading through each section. Glass becomes ice. Particle streams slow to near stillness.

Spineless packages the compiled Next.js project and pushes it to Vercel via API. The Output Card shows deployment progress: compiling → deploying → live. A production URL surfaces on the Output Card face. The system is running. The user never wrote a deploy command.

---

## Iterating in Sealed State

Days later. The Eval Card is pulsing amber — pass rate has drifted from 94% to 71%. The card face shows the trend without any interaction.

The user clicks into the Eval Card. It expands in place — showing failed cases as miniature ghost flows. A pattern is clear: responses too verbose for short tickets.

The Eval Card suggests: *"Add length constraint to Draft Prompt?"*

The user clicks **Apply**. The suggestion queues as a `PendingChange` on the Draft Prompt Card — a subtle pending indicator appears. The production system is unchanged.

When the user triggers **Release**, the queued change validates against the current snapshot, compiles, pushes to Vercel, updates the production system, and clears from the queue on success. The system remains Sealed. The Eval Card drift clears.

---

## Returning to Live

The user wants to add a new card — a structural change. They trigger **Return to Live**.

The crystallization dissolves — warm-to-cold reversal, the spine returning to Live visual language. A banner shows: "1 queued production change will apply on your next release." The pending change is preserved and will be validated/rebased before the next Release.

The user makes structural changes freely. When ready, they Seal again. The pending change carries forward and is included, rejected, rebased, or marked conflicted before Release alongside any new Sealed edits.

---

## What the User Never Does

- Opens a terminal
- Reads or edits source code
- Manages dependencies or environment configuration
- Writes a deploy command
- Searches a codebase for where a prompt lives
- Reads a log file to understand why something failed
- Manually updates a diagram when the system changes
- Loses track of what their system does

These are not features Spineless removes. They are problems Spineless was built so the user never encounters.
