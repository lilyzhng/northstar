import { App, TFile } from "obsidian";
import { ActaTaskData, ActaFeedbackData, ActaNegativeFeedbackData, ActaTaskSettings } from "./types";
import {
	DaySignals,
	TaskSignal,
	FeedbackSignal,
	ReflectionSignal,
	VaultActivity,
	TIME_ANNOTATION_REGEX,
} from "./northStarTypes";

export type ObserveStepCallback = (step: string, detail: string) => void;

export class NorthStarObserver {
	constructor(
		private app: App,
		private settings: ActaTaskSettings,
		private taskData: ActaTaskData,
		private feedbackData: ActaFeedbackData,
		private negativeFeedbackData: ActaNegativeFeedbackData
	) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	updateData(
		taskData: ActaTaskData,
		feedbackData: ActaFeedbackData,
		negativeFeedbackData: ActaNegativeFeedbackData
	): void {
		this.taskData = taskData;
		this.feedbackData = feedbackData;
		this.negativeFeedbackData = negativeFeedbackData;
	}

	async observe(dateStr: string, onStep?: ObserveStepCallback): Promise<DaySignals> {
		onStep?.("tasks", "Scanning task board...");
		const tasks = this.extractTaskSignals(dateStr);
		const completedCount = tasks.filter(t => t.completed).length;
		const deepWorkCount = tasks.filter(t => t.effort === "deep_work").length;
		onStep?.("tasks", `Found ${tasks.length} tasks (${completedCount} completed, ${deepWorkCount} deep work)`);

		onStep?.("positive-feedback", "Scanning positive feedback...");
		const positiveFeedback = this.extractPositiveFeedbackSignals(dateStr);
		onStep?.("positive-feedback", `Found ${positiveFeedback.length} positive feedback entries`);

		onStep?.("negative-feedback", "Scanning negative feedback...");
		const negativeFeedback = this.extractNegativeFeedbackSignals(dateStr);
		onStep?.("negative-feedback", `Found ${negativeFeedback.length} negative feedback entries`);

		const feedback = [...positiveFeedback, ...negativeFeedback];

		onStep?.("reflections", "Scanning #northstar reflections...");
		const reflections = await this.extractReflections(dateStr);
		onStep?.("reflections", `Found ${reflections.length} reflections`);

		onStep?.("vault", "Checking vault activity...");
		const vaultActivity = this.getVaultActivity(dateStr);
		onStep?.("vault", `${vaultActivity.filesModified} files across ${vaultActivity.foldersActive.length} folders`);

		return {
			date: dateStr,
			tasks,
			feedback,
			reflections,
			vaultActivity,
		};
	}

	private extractTaskSignals(dateStr: string): TaskSignal[] {
		const signals: TaskSignal[] = [];
		const compactDate = dateStr.replace(/-/g, "");

		for (const task of Object.values(this.taskData.addedTasks)) {
			if (!task.filePath.includes(compactDate)) continue;

			const timeMatch = task.text.match(TIME_ANNOTATION_REGEX);
			let durationMin: number | undefined;
			let timeAnnotation: string | undefined;

			if (timeMatch) {
				timeAnnotation = timeMatch[0];
				durationMin = this.parseDuration(timeMatch[1], timeMatch[2]);
			}

			signals.push({
				title: task.text,
				tags: task.tags,
				completed: task.completed,
				timeAnnotation,
				durationMin,
				effort: timeMatch ? "deep_work" : "quick_action",
			});
		}

		return signals;
	}

	private parseDuration(startStr: string, endStr: string): number {
		const startHour = this.parseHour(startStr);
		const endHour = this.parseHour(endStr);
		let diff = endHour - startHour;
		if (diff <= 0) diff += 12;
		return Math.round(diff * 60);
	}

	private parseHour(timeStr: string): number {
		const cleaned = timeStr.replace(":", "");
		if (cleaned.length <= 2) {
			return parseInt(cleaned, 10);
		}
		const hours = parseInt(cleaned.slice(0, -2), 10);
		const minutes = parseInt(cleaned.slice(-2), 10);
		return hours + minutes / 60;
	}

	private extractPositiveFeedbackSignals(dateStr: string): FeedbackSignal[] {
		const signals: FeedbackSignal[] = [];
		const compactDate = dateStr.replace(/-/g, "");

		for (const item of Object.values(this.feedbackData.addedFeedback)) {
			if (!item.filePath.includes(compactDate)) continue;
			signals.push({
				text: item.text,
				tags: item.tags,
				type: "positive",
			});
		}

		return signals;
	}

	private extractNegativeFeedbackSignals(dateStr: string): FeedbackSignal[] {
		const signals: FeedbackSignal[] = [];
		const compactDate = dateStr.replace(/-/g, "");

		for (const item of Object.values(this.negativeFeedbackData.addedNegativeFeedback)) {
			if (!item.filePath.includes(compactDate)) continue;
			signals.push({
				text: item.text,
				tags: item.tags,
				type: "negative",
			});
		}

		return signals;
	}

	private async extractReflections(dateStr: string): Promise<ReflectionSignal[]> {
		const reflections: ReflectionSignal[] = [];
		const compactDate = dateStr.replace(/-/g, "");
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!file.path.includes(compactDate)) continue;

			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");

			for (const line of lines) {
				if (line.toLowerCase().includes("#northstar")) {
					const cleanText = line
						.replace(/^[\s]*[-*]\s+/, "")
						.replace(/#northstar/gi, "")
						.trim();
					if (cleanText.length > 0) {
						reflections.push({
							text: cleanText,
							filePath: file.path,
						});
					}
				}
			}
		}

		return reflections;
	}

	private getVaultActivity(dateStr: string): VaultActivity {
		const compactDate = dateStr.replace(/-/g, "");
		const files = this.app.vault.getMarkdownFiles();
		let filesModified = 0;
		const foldersSet = new Set<string>();

		for (const file of files) {
			if (file.path.includes(compactDate)) {
				filesModified++;
				const folder = file.parent?.path || "/";
				foldersSet.add(folder);
			}
		}

		return {
			filesModified,
			foldersActive: Array.from(foldersSet),
		};
	}
}
