import { NorthStarManager } from "./northStarManager";
import { NorthStarObserver } from "./northStarObserver";
import { NorthStarLlmClient } from "./northStarLlmClient";
import {
	Assessment,
	DaySignals,
	NorthStarGoal,
	NorthStarPolicy,
	SignalBreakdownItem,
} from "./northStarTypes";

export type CycleProgressCallback = (step: string, status: "running" | "done", detail: string) => void;

export class NorthStarAgent {
	constructor(
		private manager: NorthStarManager,
		private observer: NorthStarObserver,
		private llmClient: NorthStarLlmClient
	) {}

	async observeSignals(dateStr: string, onProgress?: CycleProgressCallback): Promise<DaySignals> {
		return this.observer.observe(dateStr, (step, detail) => {
			const isRunning = detail.startsWith("Scanning") || detail.startsWith("Checking");
			onProgress?.(step, isRunning ? "running" : "done", detail);
		});
	}

	async assessSignals(goalId: string, dateStr: string, signals: DaySignals): Promise<Assessment> {
		const ctx = this.manager.getGoalContext(goalId);
		if (!ctx) throw new Error(`No goal context found for goalId: ${goalId}`);
		const dayNumber = this.manager.getDayNumber(goalId);
		const assessment = await this.assess(ctx.goal, signals, ctx.policy, dayNumber, dateStr);
		assessment.goalId = goalId;
		await this.manager.addAssessment(goalId, assessment);
		return assessment;
	}

	async runCycle(goalId: string, dateStr: string, onProgress?: CycleProgressCallback): Promise<Assessment> {
		const ctx = this.manager.getGoalContext(goalId);
		if (!ctx) throw new Error(`No goal context found for goalId: ${goalId}`);

		const dayNumber = this.manager.getDayNumber(goalId);

		// OBSERVE — each sub-step reports progress
		const signals = await this.observer.observe(dateStr, (step, detail) => {
			const isRunning = detail.startsWith("Scanning") || detail.startsWith("Checking");
			onProgress?.(step, isRunning ? "running" : "done", detail);
		});

		// ASSESS
		onProgress?.("assess", "running", "Sending signals to Claude for assessment...");
		const assessment = await this.assess(ctx.goal, signals, ctx.policy, dayNumber, dateStr);
		assessment.goalId = goalId;
		onProgress?.("assess", "done", `Assessment complete — score: ${assessment.overallScore}/100`);

		// STORE
		onProgress?.("save", "running", "Saving assessment...");
		await this.manager.addAssessment(goalId, assessment);
		onProgress?.("save", "done", "Assessment saved to data.json");

		return assessment;
	}

	private async assess(
		goal: NorthStarGoal,
		signals: DaySignals,
		policy: NorthStarPolicy,
		dayNumber: number,
		dateStr: string
	): Promise<Assessment> {
		const systemPrompt = this.buildAssessSystemPrompt();
		const userMessage = this.buildAssessUserMessage(goal, signals, policy, dayNumber);

		const rawResponse = await this.llmClient.call(systemPrompt, userMessage);
		return this.parseAssessResponse(rawResponse, dateStr, dayNumber, signals, policy.version, goal.id);
	}

	private buildAssessSystemPrompt(): string {
		return `You are an alignment assessment agent for a personal goal-tracking system called North Star.

Your job: Given a user's locked goal, today's priority actions, and the current measurement policy (signal weights), produce a structured assessment of how aligned today's work was with the goal.

IMPORTANT: You are ONLY evaluating the user's Priority Actions — these are the tasks they deliberately chose to focus on today. Ignore any other tasks. Judge completion and effort based solely on these priority actions.

You MUST respond with valid JSON only — no markdown, no explanation outside the JSON. The JSON must match this schema:

{
  "overallScore": <number 0-100>,
  "signalBreakdown": [
    {
      "category": "<string: goalDirectDeepWork | taskCompletion | reflectionDepth | pipelineActivity | feedbackSignals>",
      "weight": <number: the weight from the policy>,
      "score": <number: points earned>,
      "maxScore": <number: max possible points for this category = weight * 100>,
      "reasoning": "<string: 1-2 sentence explanation>"
    }
  ],
  "driftIndicators": ["<string: specific observation of misalignment>"],
  "momentumIndicators": ["<string: specific observation of progress>"]
}

Rules:
- overallScore = sum of all signalBreakdown scores
- Each category's maxScore = weight * 100
- Be specific in reasoning — reference actual task names, feedback entries, and reflections
- Drift indicators should cite concrete evidence of misalignment
- Momentum indicators should cite concrete evidence of progress
- If signals are empty for a category, score it low but explain why
- Be honest and calibrated — don't inflate scores
- goalDirectDeepWork includes ANY sustained focused work toward the goal: coding, reading papers, research, studying, designing, writing, deep thinking sessions — not just "development" or "coding". Any task with a time annotation (e.g. @10PM-1AM) represents a focused work block and counts as deep work.
- taskCompletion is based ONLY on the priority actions listed — how many were completed vs planned. Do NOT count non-priority tasks.`;
	}

	private buildAssessUserMessage(
		goal: NorthStarGoal,
		signals: DaySignals,
		policy: NorthStarPolicy,
		dayNumber: number
	): string {
		const priorityTasks = signals.tasks.filter(t => t.priority);

		const contextSection = goal.context
			? `\n## Goal Context\n${goal.context}\n`
			: "";

		return `## Locked Goal
"${goal.text}"
Time window: ${goal.timeWindowDays} days
Current phase: ${goal.currentPhase}
Day: ${dayNumber} of ${goal.timeWindowDays}
${contextSection}
## Measurement Policy (v${policy.version})
Signal weights:
- goalDirectDeepWork: ${policy.signalWeights.goalDirectDeepWork}
- taskCompletion: ${policy.signalWeights.taskCompletion}
- reflectionDepth: ${policy.signalWeights.reflectionDepth}
- pipelineActivity: ${policy.signalWeights.pipelineActivity}
- feedbackSignals: ${policy.signalWeights.feedbackSignals}

${policy.milestones.length > 0 ? `Milestones:\n${policy.milestones.map(m => `- ${m.text} (deadline: ${m.deadline}, completed: ${m.completed})`).join("\n")}` : "No milestones set yet."}

## Today's Priority Actions (${priorityTasks.length} tasks — ONLY evaluate these)

${priorityTasks.length > 0
	? priorityTasks.map(t => `- [${t.completed ? "x" : " "}] ${t.title} ${t.tags.join(" ")} | effort: ${t.effort}${t.timeAnnotation ? ` | time: ${t.timeAnnotation} (${t.durationMin}min)` : ""}`).join("\n")
	: "No priority actions set for today."}

### Feedback (${signals.feedback.length})
${signals.feedback.length > 0
	? signals.feedback.map(f => `- [${f.type}] ${f.text} ${f.tags.join(" ")}`).join("\n")
	: "No feedback entries today."}

### Reflections (${signals.reflections.length})
${signals.reflections.length > 0
	? signals.reflections.map(r => `- ${r.text}`).join("\n")
	: "No #northstar reflections today."}

### Vault Activity
- Files modified: ${signals.vaultActivity.filesModified}
- Active folders: ${signals.vaultActivity.foldersActive.join(", ") || "none"}

Produce the assessment JSON now. Remember: taskCompletion is based ONLY on the ${priorityTasks.length} priority actions above.`;
	}

	private parseAssessResponse(
		raw: string,
		dateStr: string,
		dayNumber: number,
		signals: DaySignals,
		policyVersion: number,
		goalId: string
	): Assessment {
		let jsonStr = raw.trim();
		const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		return {
			id: `assess-${dateStr}-${Date.now()}`,
			goalId,
			date: dateStr,
			dayNumber,
			overallScore: Math.max(0, Math.min(100, parsed.overallScore || 0)),
			signalBreakdown: (parsed.signalBreakdown || []).map((s: SignalBreakdownItem) => ({
				category: s.category,
				weight: s.weight,
				score: s.score,
				maxScore: s.maxScore,
				reasoning: s.reasoning,
			})),
			driftIndicators: parsed.driftIndicators || [],
			momentumIndicators: parsed.momentumIndicators || [],
			rawSignals: signals,
			policyVersion,
		};
	}
}
