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
		onStep?.("tasks", "Scanning daily note for priority actions...");
		const tasks = await this.extractPriorityTasksFromNote(dateStr);
		const completedCount = tasks.filter(t => t.completed).length;
		const deepWorkCount = tasks.filter(t => t.effort === "deep_work").length;
		onStep?.("tasks", `Found ${tasks.length} priority actions (${completedCount} completed, ${deepWorkCount} deep work)`);

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

	/**
	 * Read priority tasks directly from the daily note's "Today's Priority Actions" section.
	 * This is the single source of truth — no task board indirection.
	 */
	private async extractPriorityTasksFromNote(dateStr: string): Promise<TaskSignal[]> {
		const signals: TaskSignal[] = [];
		const compactDate = dateStr.replace(/-/g, "");
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			if (!file.path.includes(compactDate)) continue;

			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");

			let inPrioritySection = false;
			for (const line of lines) {
				// Detect "Today's Priority Actions" heading (any heading level)
				if (/^#{1,6}\s+Today'?s?\s+Priority\s+Actions/i.test(line)) {
					inPrioritySection = true;
					continue;
				}

				// Exit section on next heading
				if (inPrioritySection && /^#{1,6}\s+/.test(line)) {
					break;
				}

				// Parse each checkbox line in the priority section
				if (inPrioritySection) {
					const checkboxMatch = line.match(/^\s*-\s+\[([ xX])\]\s+(.*)/i);
					if (checkboxMatch) {
						const completed = checkboxMatch[1].toLowerCase() === "x";
						const fullText = checkboxMatch[2];

						// Extract time annotation
						const timeMatch = fullText.match(TIME_ANNOTATION_REGEX);
						let timeAnnotation: string | undefined;
						let durationMin: number | undefined;
						if (timeMatch) {
							timeAnnotation = timeMatch[0];
							durationMin = this.parseDuration(timeMatch[1], timeMatch[2]);
						}

						// Extract tags
						const tags: string[] = [];
						const tagMatches = fullText.matchAll(/#(\w+)/g);
						for (const m of tagMatches) {
							tags.push(`#${m[1]}`);
						}

						// Clean title: remove tags, time annotations, links
						const title = fullText
							.replace(TIME_ANNOTATION_REGEX, "")
							.replace(/\[\[.*?\]\]/g, "")
							.replace(/\[.*?\]\(.*?\)/g, "")
							.replace(/\s+/g, " ")
							.trim();

						if (title.length > 0) {
							signals.push({
								title,
								tags,
								completed,
								timeAnnotation,
								durationMin,
								effort: timeMatch ? "deep_work" : "quick_action",
								priority: true,
							});
						}
					}
				}
			}
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

			// Pick up lines tagged with #northstar anywhere in the note
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

			// Also pick up content under a "Reflection" heading section
			let inReflectionSection = false;
			for (const line of lines) {
				if (/^#{1,6}\s+Reflection/i.test(line)) {
					inReflectionSection = true;
					continue;
				}

				// Exit on next heading
				if (inReflectionSection && /^#{1,6}\s+/.test(line)) {
					break;
				}

				if (inReflectionSection) {
					const cleanText = line
						.replace(/^[\s]*[-*]\s+/, "")
						.replace(/#\w+/g, "")
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
