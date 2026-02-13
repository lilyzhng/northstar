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

	async runCycle(dateStr: string, onProgress?: CycleProgressCallback): Promise<Assessment> {
		const goal = this.manager.getGoal();
		if (!goal) {
			throw new Error("No active goal set");
		}

		const policy = this.manager.getPolicy();
		const dayNumber = this.manager.getDayNumber();

		// OBSERVE — each sub-step reports progress
		const signals = await this.observer.observe(dateStr, (step, detail) => {
			// Observer calls twice per step: first "Scanning..." (running), then "Found X" (done)
			const isRunning = detail.startsWith("Scanning") || detail.startsWith("Checking");
			onProgress?.(step, isRunning ? "running" : "done", detail);
		});

		// ASSESS
		onProgress?.("assess", "running", "Sending signals to Claude for assessment...");
		const assessment = await this.assess(goal, signals, policy, dayNumber, dateStr);
		onProgress?.("assess", "done", `Assessment complete — score: ${assessment.overallScore}/100`);

		// STORE
		onProgress?.("save", "running", "Saving assessment...");
		await this.manager.addAssessment(assessment);
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
		return this.parseAssessResponse(rawResponse, dateStr, dayNumber, signals, policy.version);
	}

	private buildAssessSystemPrompt(): string {
		return `You are an alignment assessment agent for a personal goal-tracking system called North Star.

Your job: Given a user's locked goal, today's activity signals, and the current measurement policy (signal weights), produce a structured assessment of how aligned today's work was with the goal.

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
- Be honest and calibrated — don't inflate scores`;
	}

	private buildAssessUserMessage(
		goal: NorthStarGoal,
		signals: DaySignals,
		policy: NorthStarPolicy,
		dayNumber: number
	): string {
		return `## Locked Goal
"${goal.text}"
Time window: ${goal.timeWindowDays} days
Current phase: ${goal.currentPhase}
Day: ${dayNumber} of ${goal.timeWindowDays}

## Measurement Policy (v${policy.version})
Signal weights:
- goalDirectDeepWork: ${policy.signalWeights.goalDirectDeepWork}
- taskCompletion: ${policy.signalWeights.taskCompletion}
- reflectionDepth: ${policy.signalWeights.reflectionDepth}
- pipelineActivity: ${policy.signalWeights.pipelineActivity}
- feedbackSignals: ${policy.signalWeights.feedbackSignals}

${policy.milestones.length > 0 ? `Milestones:\n${policy.milestones.map(m => `- ${m.text} (deadline: ${m.deadline}, completed: ${m.completed})`).join("\n")}` : "No milestones set yet."}

## Today's Signals (${signals.date})

### Tasks (${signals.tasks.length})
${signals.tasks.length > 0
	? signals.tasks.map(t => `- [${t.completed ? "x" : " "}] ${t.title} ${t.tags.join(" ")} | effort: ${t.effort}${t.timeAnnotation ? ` | time: ${t.timeAnnotation} (${t.durationMin}min)` : ""}`).join("\n")
	: "No tasks recorded today."}

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

Produce the assessment JSON now.`;
	}

	private parseAssessResponse(
		raw: string,
		dateStr: string,
		dayNumber: number,
		signals: DaySignals,
		policyVersion: number
	): Assessment {
		let jsonStr = raw.trim();
		const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
		if (jsonMatch) {
			jsonStr = jsonMatch[1].trim();
		}

		const parsed = JSON.parse(jsonStr);

		return {
			id: `assess-${dateStr}-${Date.now()}`,
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
