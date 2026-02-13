# North Star — Product Design

## What Is It

North Star is the 4th board in Acta-Task. The other three boards are passive records — you write tasks, log feedback. North Star is different: it's an **active agent** that watches what you do, tells you whether you're converging on your goal, and evolves how it measures you over time.

You set a goal. You lock it in. Then you just work — write notes, complete tasks, log feedback like you normally do. North Star reads all of that and tells you: "Here's how aligned your day was. Here's where you're drifting. Here's what to think about tomorrow."

## Design Principles

1. **The goal is immutable; everything else evolves.** You set the north star once and lock it. The system's measurement strategy, the questions it asks you, and how it breaks down the goal all adapt continuously — but the goal itself never changes.

2. **System-derived alignment, not self-reported.** You don't score yourself "4/5." You work and reflect naturally. The system reads your signals and derives alignment. This prevents self-assessment drift.

3. **Transparent evolution.** Every time the system changes how it measures you, it logs why. You can see the reasoning, approve or reject changes, and revert anything.

4. **Cross-signal intelligence.** Alignment isn't one number from one input. It's triangulated from your tasks, your positive feedback, your negative feedback, your reflections, and your vault activity patterns.

## How It Works — The Agent Loop

North Star runs a cycle (daily, or when you trigger it):

```
OBSERVE → ASSESS → REFLECT → ADAPT
   ↑                            │
   └────────────────────────────┘
```

Tinker sits alongside the loop as the interactive layer — you think and act with it at any point, and your conversations feed back into the next OBSERVE cycle.

### 1. OBSERVE — What did you do today?

The system collects raw signals from your vault. No judgment yet, just gathering.

| Signal source | What it reads |
|---------------|---------------|
| Task board | Tasks created, completed, abandoned, overdue |
| Positive feedback board | What you said went well |
| Negative feedback board | What you said needs improvement |
| Daily notes / reflections | Free-form writing tagged `#northstar` or in your daily note |
| Vault activity | Which files and folders you worked in |

### 2. ASSESS — How aligned was today?

The LLM receives your goal, today's signals, and the current measurement policy. It returns:

- **Overall alignment score** (0–100) — not a self-report, a system assessment
- **Signal breakdown** — which signals contributed how much, with reasoning
- **Drift indicators** — specific observations of misalignment ("You spent most of today on X, which doesn't connect to the goal")
- **Momentum indicators** — specific observations of progress ("Three tasks completed that directly advance milestone Y")

The user sees the reasoning, not just a number. Transparency is the product.

### 3. REFLECT — What's the trajectory?

Looking at the last several days of assessments, the system identifies:

- **Trend** — accelerating, steady, decelerating, stalled, or regressing
- **Patterns** — recurring themes ("You tend to drift on Fridays," "Your alignment spikes after negative feedback entries")
- **Risks** — what happens if the current trajectory continues
- **Opportunities** — potential accelerators it's noticed

### 4. ADAPT — Evolve the measurement

This is the self-evolvement. The system proposes changes to its own policy. The goal stays fixed; how it's measured changes.

**What can evolve:**

**a) Signal weights** — What matters changes over time. Early on, deep reflection matters more than task throughput. Later, execution matters more than exploration. The system shifts these weights and tells you why.

> Example: Week 1 → "reflection depth" weighs 40%, "task completion" weighs 10%. Week 5 → those swap.

**b) Check-in prompts** — The questions the system asks you evolve based on context. It's not the same generic "how did today go?" every day.

> Example: Day 1 → "What did you explore today related to your goal?"
> Day 15 → "You've been focused on X for a week. Is X still the right bet?"
> Day 30 → "What's blocking you from shipping? Be specific."

**c) Goal decomposition (milestones)** — The system breaks your north star into sub-milestones and adapts them as it learns. Milestones can be completed, dropped, or evolved into something better. Each change is explained.

> Example: "Research competitor landscape" → completed → evolved into "Define differentiators based on research findings"

**Confidence threshold:** High-confidence changes (like transitioning phases when milestones are done) are auto-applied and logged. Low-confidence changes are queued for your review. You always have final say.

## Phases

Goals naturally move through phases. The system starts with sensible defaults and evolves from there.

**Exploration** — Understanding the problem, researching, casting a wide net. Low alignment scores are expected and fine. The system weights reflection depth and breadth of activity.

**Execution** — Building, shipping, doing focused work. The system shifts to weighting task completion, problem resolution, and depth of activity.

**Refinement** — Polishing, closing gaps, finishing. High alignment expected. The system weights completion and resolution of known issues.

The system can transition between phases, add new ones, or redefine what they mean — but it explains every change.

## The Key Invariant

**The north star goal is never modified by the agent.** It's the fixed point everything orbits. The system evolves *how* it measures alignment, *what* it asks you, and *how* it breaks down the goal — but it cannot change what the goal *is*.

If the goal itself turns out to be wrong, you abandon it and create a new one. You don't quietly edit it.

**User controls:**
- Review and revert any policy change from the evolution log
- Reset the policy to defaults for the current phase
- Manually override signal weights or milestones
- Trigger a new agent cycle on-demand

## What the User Experience Looks Like

### Setting a goal
You open the North Star board → click "Set Goal" → type your goal and time window (e.g., 45 days) → the system locks it in, seeds initial phases and milestones, and starts watching.

### Daily workflow
You don't change your workflow. You write tasks, log feedback, write daily notes. If you want to write a specific north star reflection, you tag it `#northstar`. The system reads everything on its next cycle.

### Opening the board
You see your goal prominently at the top (it never changes). Below it: today's alignment score with a breakdown of why. Current phase. Milestone progress. Any warnings. Today's evolved prompts for reflection. At the bottom: the evolution log showing how the system has adapted itself.

### Reviewing a policy change
A notification badge appears when the system has a pending change. You click it, see what the system wants to change and why, and approve or reject. Example: "I'm proposing to increase the weight of task completion from 0.15 to 0.30 because you've moved from exploration into execution — your last 5 days show a shift from research to building."

### End of window
When the window closes, the system generates a retrospective: how alignment evolved, what phases you went through, which milestones were completed/dropped/evolved, and what it learned about how you work. This gets archived. You can start a new goal.

## Tinker

The NorthStar board includes a built-in chat panel. This isn't a general-purpose AI chat — it's a Tinker that already knows your goal, your current phase, your trajectory, and your recent drift patterns.

### Why not use an external chat plugin?

General-purpose chat tools (like Claudian) are executors — they default to writing notes, editing files, taking action. NorthStar needs a Tinker that pushes back, asks hard questions, and helps you reason about your goal. Different purpose, different persona, different UX.

More importantly: context. A NorthStar conversation starts pre-loaded with your locked goal, current phase, latest assessment, milestone status, and recent drift/momentum signals. You don't explain where you are — the Tinker already knows. An external chat would need you to re-establish context every time, or would respond without it.

### What the Tinker does

It starts as a pure Tinker and grows into an executor as the product matures.

**Phase 1: Think only.** The chat helps you reason about your goal. It doesn't touch anything.

- Challenge your assumptions — "You say approach A isn't working, but your alignment actually increased the two days you focused on it. What specifically feels wrong?"
- Surface patterns you can't see — "The last three times you mentioned pivoting, it was on a Monday after a low-output weekend. Is this a real signal or a rhythm thing?"
- Pressure-test decisions — "If you drop milestone X, what's your path to the goal without it? Walk me through it."
- Help you unstick — "Your alignment has been flat for 5 days. Let's look at what changed. Your negative feedback from Thursday mentioned Y — is that still unresolved?"

**Phase 2: Think + execute within NorthStar's domain.** Once the Tinker dynamic is validated, the chat gains the ability to act on conclusions you reach together — but only within NorthStar's own scope:

- Update milestones — "OK, let's drop milestone X and replace it with Y" → the agent does it
- Add tasks to the task board — "I need to do A, B, C this week to get back on track" → tasks created
- Adjust signal weights or phase — "You're right, I'm past exploration" → phase transition applied
- Trigger a new assessment cycle — "Let's re-evaluate after this conversation"

The boundary: The Tinker executes within the Acta-Task system (milestones, tasks, policy, feedback). It doesn't become a general-purpose vault editor or file manager — that's Claudian's territory. The Tinker acts on *decisions about the goal*, not on arbitrary vault operations.

### Conversations as signal

Every Tinker conversation feeds back into the agent loop. What you discuss becomes input to the next OBSERVE cycle.

If you express doubt about a milestone, the system notices. If you talk through a pivot and commit to it, that informs the next assessment. If you surface a blocker in conversation that doesn't appear in your tasks or feedback, the system now knows about it.

This closes the loop: the board surfaces insights → you discuss them in chat → the conversation becomes a new signal → the next cycle is more informed.

### What it looks like

The chat panel lives on the NorthStar board, alongside the dashboard. You see your alignment score, milestones, and drift warnings on one side. The chat is right there — you can react to what you see, ask "why did my alignment drop?" and get an answer grounded in your actual signals, not a generic response.

The conversation is persistent within a goal window. You can scroll back through past conversations and see how your thinking evolved alongside the system's assessments.

### What it never does

- No general vault file writing or editing — that's Claudian
- No vault commands, bash, or search
- No general Q&A unrelated to the goal
- No action outside the Acta-Task system boundary

## Open Questions

1. **LLM cost**: Each cycle involves LLM calls. Should we batch into one call or separate calls for assess/reflect/adapt?
2. **Offline fallback**: What if the LLM is unreachable? Skip and retry, or fall back to a simpler mode?
3. **Multiple goals**: One north star at a time (enforced focus), or parallel goals?
4. **Cross-goal learning**: When a goal is archived, should the system carry forward what it learned about your work patterns to seed the next goal's policy?
5. **Privacy**: The system reads your vault. Should there be an include/exclude list for which folders are scanned?
