import { App, TFile, Notice } from "obsidian";
import { TaskItem, ActaTaskSettings, ActaTaskData } from "./types";

const TASK_REGEX_BASE = /^[\s]*[-*]\s+\[([ xX])\]\s*/;
const INLINE_TAG_REGEX = /#[\w\-\/]+/g;

export class TaskManager {
	constructor(
		private app: App,
		private settings: ActaTaskSettings,
		private data: ActaTaskData,
		private saveData: () => Promise<void>
	) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	updateData(data: ActaTaskData): void {
		this.data = data;
	}

	/**
	 * Check if a line contains a task with inline hashtag
	 */
	hasInlineTag(line: string): boolean {
		const match = line.match(TASK_REGEX_BASE);
		if (!match) return false;

		const textAfterCheckbox = line.substring(match[0].length);
		return INLINE_TAG_REGEX.test(textAfterCheckbox);
	}

	/**
	 * Extract inline tags from task text
	 */
	extractInlineTags(text: string): string[] {
		const matches = text.match(INLINE_TAG_REGEX);
		return matches ? matches.map(tag => tag.toLowerCase()) : [];
	}

	/**
	 * Parse task from line (returns null if not a valid task with inline tag)
	 */
	parseTaskFromLine(
		line: string,
		lineNumber: number,
		file: TFile
	): TaskItem | null {
		const match = line.match(TASK_REGEX_BASE);
		if (!match) return null;

		const textAfterCheckbox = line.substring(match[0].length).trim();
		const inlineTags = this.extractInlineTags(textAfterCheckbox);

		if (inlineTags.length === 0) return null;

		const completed = match[1].toLowerCase() === "x";

		// Remove hashtags from display text
		const displayText = textAfterCheckbox.replace(INLINE_TAG_REGEX, '').trim();

		return {
			id: `${file.path}:${lineNumber}`,
			text: displayText,
			completed,
			filePath: file.path,
			fileName: file.basename,
			line: lineNumber,
			tags: inlineTags,
			addedAt: Date.now(),
		};
	}

	/**
	 * Add task to board (with confirmation)
	 */
	async addTask(task: TaskItem): Promise<boolean> {
		if (this.data.addedTasks[task.id]) {
			new Notice("Task is already on the board");
			return false;
		}

		this.data.addedTasks[task.id] = task;
		await this.saveData();
		new Notice("Task added to board");
		return true;
	}

	/**
	 * Add task silently (no notice)
	 */
	async addTaskSilently(task: TaskItem): Promise<boolean> {
		if (this.data.addedTasks[task.id]) {
			return false;
		}

		this.data.addedTasks[task.id] = task;
		await this.saveData();
		return true;
	}

	/**
	 * Remove task from board
	 */
	async removeTask(taskId: string): Promise<void> {
		if (!this.data.addedTasks[taskId]) return;

		delete this.data.addedTasks[taskId];
		await this.saveData();
		new Notice("Task removed from board");
	}

	/**
	 * Check if task is already added
	 */
	isTaskAdded(taskId: string): boolean {
		return !!this.data.addedTasks[taskId];
	}

	/**
	 * Get all added tasks (synced with current file state)
	 */
	async getAddedTasks(): Promise<TaskItem[]> {
		const tasks: TaskItem[] = [];
		const toRemove: string[] = [];

		for (const [taskId, task] of Object.entries(this.data.addedTasks)) {
			const file = this.app.vault.getAbstractFileByPath(task.filePath);
			if (!(file instanceof TFile)) {
				toRemove.push(taskId);
				continue;
			}

			// Verify task still exists at that line
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");
			if (task.line >= lines.length) {
				toRemove.push(taskId);
				continue;
			}

			const line = lines[task.line];
			if (!this.hasInlineTag(line)) {
				toRemove.push(taskId);
				continue;
			}

			// Re-parse to get updated completion state and text
			const updatedTask = this.parseTaskFromLine(line, task.line, file);

			if (updatedTask) {
				// Preserve original addedAt timestamp
				updatedTask.addedAt = task.addedAt;
				tasks.push(updatedTask);
			} else {
				toRemove.push(taskId);
			}
		}

		// Clean up stale tasks
		if (toRemove.length > 0) {
			for (const id of toRemove) {
				delete this.data.addedTasks[id];
			}
			await this.saveData();
		}

		return tasks;
	}

	/**
	 * Get task at cursor position (if it has inline tag)
	 */
	async getTaskAtPosition(
		file: TFile,
		line: number
	): Promise<TaskItem | null> {
		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");
		if (line >= lines.length) return null;

		return this.parseTaskFromLine(lines[line], line, file);
	}
}
