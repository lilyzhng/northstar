import { App } from "obsidian";
import { ActaTaskSettings } from "./types";
import {
	ActaNorthStarData,
	NorthStarGoal,
	NorthStarPolicy,
	Assessment,
	DEFAULT_SIGNAL_WEIGHTS,
	DEFAULT_POLICY,
} from "./northStarTypes";

export class NorthStarManager {
	constructor(
		private app: App,
		private settings: ActaTaskSettings,
		private data: ActaNorthStarData,
		private saveData: () => Promise<void>
	) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	updateData(data: ActaNorthStarData): void {
		this.data = data;
	}

	getGoal(): NorthStarGoal | null {
		return this.data.goal;
	}

	getPolicy(): NorthStarPolicy {
		return this.data.policy;
	}

	getAssessments(): Assessment[] {
		return this.data.assessments;
	}

	getLatestAssessment(): Assessment | null {
		if (this.data.assessments.length === 0) return null;
		return this.data.assessments[this.data.assessments.length - 1];
	}

	getDayNumber(): number {
		const goal = this.data.goal;
		if (!goal) return 0;
		const lockedDate = new Date(goal.lockedAt);
		lockedDate.setHours(0, 0, 0, 0);
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const diffMs = now.getTime() - lockedDate.getTime();
		return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
	}

	getDaysLeft(): number {
		const goal = this.data.goal;
		if (!goal) return 0;
		return Math.max(0, goal.timeWindowDays - this.getDayNumber() + 1);
	}

	async setGoal(text: string, timeWindowDays: number): Promise<NorthStarGoal> {
		// Archive current goal if exists
		if (this.data.goal) {
			this.data.goal.active = false;
			this.data.archivedGoals.push(this.data.goal);
		}

		const goal: NorthStarGoal = {
			id: `ns-${Date.now()}`,
			text,
			timeWindowDays,
			lockedAt: Date.now(),
			currentPhase: "exploration",
			active: true,
		};

		this.data.goal = goal;
		this.data.policy = {
			signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
			checkInPrompts: [],
			milestones: [],
			version: 1,
		};
		this.data.assessments = [];

		await this.saveData();
		return goal;
	}

	async addAssessment(assessment: Assessment): Promise<void> {
		// Replace existing assessment for the same date, or add new
		const existingIndex = this.data.assessments.findIndex(
			(a) => a.date === assessment.date
		);
		if (existingIndex >= 0) {
			this.data.assessments[existingIndex] = assessment;
		} else {
			this.data.assessments.push(assessment);
		}
		await this.saveData();
	}

	async archiveGoal(): Promise<void> {
		if (!this.data.goal) return;
		this.data.goal.active = false;
		this.data.archivedGoals.push(this.data.goal);
		this.data.goal = null;
		this.data.assessments = [];
		this.data.policy = { ...DEFAULT_POLICY, signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS }, milestones: [] };
		await this.saveData();
	}
}
