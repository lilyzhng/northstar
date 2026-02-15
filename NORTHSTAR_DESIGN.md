# North Star — Product Design

## What Is It

North Star is the 4th board in Northstar. The other three boards are passive records — you write tasks, log feedback. North Star is different: it's an **active agent** that watches what you do, tells you whether you're converging on your goal, and evolves how it measures you over time.

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
| Task board | Tasks created, completed, abandoned, overdue. Parses time annotations (e.g., `@9-10AM`) to extract duration and classifies effort level (`deep_work` vs `quick_action`). |
| Positive feedback board | What you said went well |
| Negative feedback board | What you said needs improvement |
| Daily notes / reflections | Free-form writing tagged `#northstar` or in your daily note |
| Vault activity | Which files and folders you worked in |

**Time annotation convention:** When completing a task, you can add `@[start]-[end]` to log time spent (e.g., `@9-10AM`, `@2-5PM`). This is just typed text — no plugin needed. The system parses these to calculate duration and classify effort:

- Has `@` time annotation → `deep_work` (duration extracted from the range)
- No annotation → `quick_action` (bookmarks, data entries, short logs — excluded from alignment scoring)

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

### Call Architecture

The four steps map to **separate LLM calls**, not one monolithic prompt. Each step requires a different cognitive frame, and bundling them degrades the later steps.

```
Day 1-2:   OBSERVE → ASSESS → ADAPT           (2 LLM calls)
Day 3+:    OBSERVE → ASSESS → REFLECT → ADAPT  (3 LLM calls)
```

| Call | Step | Model | Why isolated |
|------|------|-------|-------------|
| 0 | OBSERVE | Fast/cheap (or rule-based) | Extraction, not reasoning. Pulls structured signals from raw vault content. No judgment. |
| 1 | ASSESS | Capable model | Evaluation — scores today against the policy. Single-day scope. Always runs. |
| 2 | REFLECT | Capable model | Pattern recognition across multiple days. Different cognitive frame than scoring. **Only runs when history >= 3 days** — below that, there are no patterns to find. |
| 3 | ADAPT | Capable model | Decision-making — proposes policy mutations. Isolated so the model focuses entirely on "what should change?" rather than treating it as an afterthought of analysis. |

**Why ASSESS and REFLECT are separate calls:**

- **Different time scope.** ASSESS looks at today. REFLECT looks at the last N days. When combined, the model's recency bias from scoring today bleeds into trajectory analysis — one bad day after six great days gets overstated as "decelerating" when the real trend is "steady with a dip."
- **Different readiness curves.** ASSESS is useful from Day 1. REFLECT is useless until Day 3 and becomes the most valuable step by Day 20. Separating them means we skip REFLECT when it would just produce filler ("Establishing baseline. Insufficient data.").
- **Frame reset.** Separation forces the model to reset its frame between "here's how today went" and "forget today's emotions, what does the 7-day picture actually look like?"

**Why ADAPT is its own call:**

- ADAPT is a decision step, not an analysis step. When it trails a long analytical prompt, the model treats policy proposals as summaries rather than deliberate choices.
- Isolating it makes policy changes auditable — the input and output of the ADAPT call are a clean record of "given this assessment and trajectory, here's what I propose to change and why."
- ADAPT can be skipped entirely on low-change days (stable trajectory, no new signals) to save cost.

---

### Example: A Full Cycle (Feb 13, 2026)

**Locked goal:** "Land a Post-Training Research Engineer role within 45 days"
**Day:** 1 of 45 · Phase: Exploration

#### Call 0: OBSERVE

The system scans the daily note and boards. No LLM reasoning — just extraction into structured signals.

```json
{
  "date": "2026-02-13",
  "tasks": {
    "completed": [
      {
        "title": "Runway interview — agentic video editing 1-pager",
        "tags": ["interview"],
        "time": "@11AM-1PM",
        "duration_min": 120,
        "effort": "deep_work"
      }
    ],
    "incomplete": [
      { "title": "Review Skydio onsite requirements", "tags": ["interview"] },
      { "title": "Choose hackathon project with Zara", "tags": ["hackathon"] },
      { "title": "Read core post-training paper (InstructGPT/DPO)", "tags": ["paper"] }
    ]
  },
  "positive_feedback": [
    { "entry": "Got a good profile photo", "tags": ["brand"], "effort": "quick_action" }
  ],
  "negative_feedback": [
    { "entry": "Work is annoying, considering negative reinforcement to motivate job search", "tags": ["work"] }
  ],
  "other_signals": [
    { "entry": "Master plan created for Post-Training RE role", "time": "@9-11AM", "duration_min": 120, "effort": "deep_work" },
    { "entry": "Uber interview confirmed Feb 24", "effort": "quick_action" },
    { "entry": "Spotted Anthropic Research Engineer posting", "effort": "quick_action" },
    { "entry": "Microsoft referral from Yan", "effort": "quick_action" }
  ]
}
```

#### Call 1: ASSESS

**Input:** Goal + today's signals + measurement policy

**Output:**

> **Alignment score: 52/100**
>
> **Time breakdown:** 4h of deep work tracked today.
> - 2h on master plan (@9-11AM) — goal-aligned
> - 2h on Runway interview prep (@11AM-1PM) — not goal-aligned
> - Quick actions (Uber confirmation, job postings, profile photo) — no meaningful time cost, excluded from alignment scoring
>
> **Signal breakdown:**
> - Goal-direct deep work (weight 0.30): 2h on master plan is strong strategic work. But only 50% of your deep work hours went to the goal. The post-training paper reading didn't happen — that's on the critical path. **15/30**
> - Task completion (weight 0.15): 1/4 completed. The completed task (Runway, 2h) is not a post-training role. **4/15**
> - Reflection depth (weight 0.25): Negative feedback shows emotional awareness of urgency. But no explicit reflection on post-training prep progress. **14/25**
> - Pipeline activity (weight 0.20): Strong — Uber confirmed, Anthropic posting spotted, Microsoft referral. These are quick actions, not time sinks. **16/20**
> - Feedback signals (weight 0.10): Profile photo is brand but not goal-critical. Work frustration is motivational, not alignment-related. **3/10**
>
> **Drift indicator:** "You had 4 hours of deep work today. Half went to Runway — a creative-AI role, not post-training. The paper reading that would directly build post-training depth got zero hours."
>
> **Momentum indicator:** "The 2h master plan is a strong foundation move. Pipeline bookmarks (Uber, Anthropic, Microsoft) are quick actions that cost you nothing — those aren't the problem."

#### Call 2: REFLECT

**Skipped.** Day 1 — no historical assessments to analyze. REFLECT activates on Day 3.

#### Call 3: ADAPT

**Input:** Today's assessment (no reflection data yet)

**Output:**

> **Proposed changes:**
>
> 1. **Add milestone** (confidence: HIGH → auto-apply):
>    - "Read and annotate 3 core post-training papers (InstructGPT, DPO, GRPO)" — deadline Feb 20
>    - *Reason: Paper reading is on today's task list but wasn't completed. Foundational for the goal.*
>
> 2. **Add milestone** (confidence: HIGH → auto-apply):
>    - "Complete Uber interview prep" — deadline Feb 23
>    - *Reason: Confirmed interview on Feb 24.*
>
> 3. **New signal proposed** (confidence: LOW → queued for review):
>    - "interview-goal-fit" — scores whether interview prep time targets post-training-aligned roles vs. unrelated ones
>    - *Reason: Today shows effort going to Runway (creative AI, not post-training). Current policy doesn't distinguish between goal-aligned and goal-adjacent interviews.*
>
> 4. **Tomorrow's check-in prompt** (confidence: HIGH → auto-apply):
>    - "You skipped the post-training paper yesterday. What got in the way, and will you read it today?"

#### What the user sees

```
╔══════════════════════════════════════════════════╗
║  ⭐ Land a Post-Training Research Engineer role  ║
║     Day 1 of 45  ·  Phase: Exploration           ║
╠══════════════════════════════════════════════════╣
║  Today's Alignment: 52/100                       ║
║  Trend: — (baseline, tracking starts Day 3)      ║
║                                                  ║
║  ⚡ Pipeline active (3 opportunities)            ║
║  ⚠️  Paper reading skipped — critical path item   ║
║  ⚠️  Runway prep may be diluting focus            ║
║                                                  ║
║  📋 Pending review: New signal "interview fit"   ║
╚══════════════════════════════════════════════════╝
```

#### Tinker conversation (same evening)

You see the 52/100 and the drift warning. You open the Tinker chat. It already has full context — your goal, today's assessment, and the signals.

> **Tinker:** Your alignment is at 52 today. I want to zoom out for a second. Looking at your plate right now: Runway interview, Skydio prep, Uber prep, hackathon with Zara, a meetup, networking, job postings from Microsoft — and the actual goal is post-training RE. How many of these are directly building toward that?
>
> **You:** Honestly, Skydio and Uber are practice interviews. Runway was more of an obligation.
>
> **Tinker:** So out of everything you worked on today, the only thing that directly advances the post-training goal is the master plan you created. The core paper reading — InstructGPT, DPO — didn't happen. That's the kind of work that compounds. Practice interviews don't build post-training depth. Are you comfortable with that trade-off today, or is this becoming a pattern?
>
> **You:** It's just today. I'll read the DPO paper tomorrow.
>
> **Tinker:** I'll hold you to that. One more thing — the hackathon project with Zara. You haven't chosen an approach yet. If you pick the Eval Agent, that's a project you could directly reference in a post-training interview: "I built an eval agent that does X." The other options are interesting but they don't help the goal. When you're already spread across Skydio, Uber, Runway, and networking — the hackathon might be your one chance this month to build something that actually demonstrates post-training skill. Don't waste it on something generic.

**What happens next:** This conversation feeds back into the loop. Tomorrow's OBSERVE picks up two signals from this chat:
1. You committed to reading the DPO paper tomorrow.
2. The Tinker flagged that practice interviews and networking are consuming time without building post-training depth.

Tomorrow's ASSESS will check whether the paper reading happened. If it didn't two days in a row, the drift warning escalates.

---

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

The boundary: The Tinker executes within the Northstar system (milestones, tasks, policy, feedback). It doesn't become a general-purpose vault editor or file manager — that's Claudian's territory. The Tinker acts on *decisions about the goal*, not on arbitrary vault operations.

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
- No action outside the Northstar system boundary

## Open Questions

1. ~~**LLM cost**: Each cycle involves LLM calls. Should we batch into one call or separate calls for assess/reflect/adapt?~~ **Resolved** — separate calls. OBSERVE is extraction (cheap/rule-based). ASSESS and REFLECT are separate calls because they require different cognitive frames and REFLECT only activates after 3+ days of history. ADAPT is isolated as a decision step. See *Call Architecture* above.
2. ~~**Offline fallback**: What if the LLM is unreachable? Skip and retry, or fall back to a simpler mode?~~ **Resolved** —  
          +do nothing. Skip the cycle and retry next time the LLM is available. No degraded mode.
3. ~~**Multiple goals**: One north star at a time (enforced focus), or parallel goals?~~ **Resolved** — one goal at a time.  
          +Enforced focus.    
4. **Cross-goal learning**: When a goal is archived, should the system carry forward what it learned about your work patterns to seed the next goal's policy?
5. **Privacy**: The system reads your vault. Should there be an include/exclude list for which folders are scanned?
