import { TaskItem, TopicGroup, ActaTaskSettings } from "./types";
import { TaskManager } from "./taskManager";
import { App, TFile } from "obsidian";

export class TaskScanner {
	constructor(
		private app: App,
		private taskManager: TaskManager,
		private settings: ActaTaskSettings
	) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
		this.taskManager.updateSettings(settings);
	}

	async scanBoard(): Promise<TopicGroup[]> {
		// Auto-add any tasks with inline tags that aren't already tracked
		await this.autoAddMarkedTasks();

		const tasks = await this.taskManager.getAddedTasks();
		return this.buildTopicGroups(tasks);
	}

	private async autoAddMarkedTasks(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (!this.taskManager.hasInlineTag(line)) continue;

				const taskId = `${file.path}:${i}`;
				if (this.taskManager.isTaskAdded(taskId)) continue;

				// Auto-add this task
				const task = this.taskManager.parseTaskFromLine(line, i, file);
				if (task) {
					await this.taskManager.addTaskSilently(task);
				}
			}
		}
	}

	private buildTopicGroups(tasks: TaskItem[]): TopicGroup[] {
		const tagTaskMap = new Map<string, TaskItem[]>();

		for (const task of tasks) {
			// Associate task with all its inline tags
			for (const tag of task.tags) {
				const normalizedTag = tag.toLowerCase();
				if (this.settings.excludedTags.includes(normalizedTag)) continue;

				if (!tagTaskMap.has(normalizedTag)) {
					tagTaskMap.set(normalizedTag, []);
				}
				tagTaskMap.get(normalizedTag)!.push(task);
			}
		}

		const groups: TopicGroup[] = [];

		for (const [tag, tasks] of tagTaskMap) {
			const sortedTasks = this.sortTasks(tasks);

			groups.push({
				tag,
				displayTag: tag.replace(/^#/, ""),
				tasks: sortedTasks,
				completedCount: sortedTasks.filter((t) => t.completed).length,
				totalCount: sortedTasks.length,
			});
		}

		return this.sortTopics(groups);
	}

	private sortTasks(tasks: TaskItem[]): TaskItem[] {
		if (this.settings.taskSortOrder === "incompleteFirst") {
			return tasks.sort((a, b) => {
				if (a.completed !== b.completed) {
					return a.completed ? 1 : -1;
				}
				return a.addedAt - b.addedAt;
			});
		}
		// byFile
		return tasks.sort(
			(a, b) =>
				a.filePath.localeCompare(b.filePath) || a.line - b.line
		);
	}

	private sortTopics(groups: TopicGroup[]): TopicGroup[] {
		if (this.settings.topicSortOrder === "taskCount") {
			return groups.sort((a, b) => b.totalCount - a.totalCount);
		}
		// alphabetical
		return groups.sort((a, b) =>
			a.displayTag.localeCompare(b.displayTag)
		);
	}
}
