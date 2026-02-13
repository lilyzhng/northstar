import { ItemView, WorkspaceLeaf, debounce, TFile } from "obsidian";
import { ACTA_TASK_VIEW_TYPE, TopicGroup, ActaTaskSettings } from "./types";
import { TaskScanner } from "./taskScanner";
import { TaskToggler } from "./taskToggler";
import { TaskManager } from "./taskManager";

export class TaskBoardView extends ItemView {
	private scanner: TaskScanner;
	private toggler: TaskToggler;
	private taskManager: TaskManager;
	private settings: ActaTaskSettings;
	private collapsedTopics: Set<string> = new Set();
	private boardEl: HTMLElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		scanner: TaskScanner,
		toggler: TaskToggler,
		taskManager: TaskManager,
		settings: ActaTaskSettings
	) {
		super(leaf);
		this.scanner = scanner;
		this.toggler = toggler;
		this.taskManager = taskManager;
		this.settings = settings;
	}

	getViewType(): string {
		return ACTA_TASK_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Acta Task Board";
	}

	getIcon(): string {
		return "list-checks";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("acta-task-container");

		this.boardEl = container.createDiv({ cls: "acta-task-board" });

		await this.refresh();
		this.registerEvents();
	}

	async onClose(): Promise<void> {
		// Cleanup handled by Obsidian's event unregistration
	}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
		this.scanner.updateSettings(settings);
		this.refresh();
	}

	private registerEvents(): void {
		const debouncedRefresh = debounce(() => this.refresh(), 500, true);

		this.registerEvent(
			this.app.metadataCache.on("changed", () => debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on("create", () => debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on("delete", () => debouncedRefresh())
		);
		this.registerEvent(
			this.app.vault.on("rename", () => debouncedRefresh())
		);
	}

	async refresh(): Promise<void> {
		if (!this.boardEl) return;

		const topics = await this.scanner.scanBoard();
		this.renderBoard(topics);
	}

	private renderBoard(topics: TopicGroup[]): void {
		if (!this.boardEl) return;
		this.boardEl.empty();

		// Header
		const header = this.boardEl.createDiv({ cls: "acta-task-header" });
		const titleRow = header.createDiv({ cls: "acta-task-title-row" });
		titleRow.createEl("h4", { text: "Task Board" });

		const refreshBtn = titleRow.createEl("button", {
			cls: "acta-task-refresh-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
		refreshBtn.addEventListener("click", () => this.refresh());

		// Stats
		const totalTasks = topics.reduce((sum, t) => sum + t.totalCount, 0);
		const completedTasks = topics.reduce(
			(sum, t) => sum + t.completedCount,
			0
		);
		header.createDiv({
			cls: "acta-task-stats",
			text: `${completedTasks}/${totalTasks} done across ${topics.length} topics`,
		});

		if (topics.length === 0) {
			this.boardEl.createDiv({
				cls: "acta-task-empty",
				text: "No tasks yet. Add checkboxes with inline hashtags (e.g. - [ ] #people do something) to see them here.",
			});
			return;
		}

		// Topic sections
		const list = this.boardEl.createDiv({ cls: "acta-task-topics" });
		for (const topic of topics) {
			this.renderTopicSection(list, topic);
		}
	}

	private renderTopicSection(
		parent: HTMLElement,
		topic: TopicGroup
	): void {
		const section = parent.createDiv({ cls: "acta-task-topic-section" });
		const isCollapsed = this.collapsedTopics.has(topic.tag);

		// Topic header
		const topicHeader = section.createDiv({
			cls: "acta-task-topic-header",
		});

		const chevron = topicHeader.createSpan({
			cls: `acta-task-chevron ${isCollapsed ? "is-collapsed" : ""}`,
		});
		chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

		topicHeader.createSpan({
			cls: "acta-task-topic-tag",
			text: `#${topic.displayTag}`,
		});

		topicHeader.createSpan({
			cls: "acta-task-topic-count",
			text: `${topic.completedCount}/${topic.totalCount}`,
		});

		topicHeader.addEventListener("click", () => {
			if (this.collapsedTopics.has(topic.tag)) {
				this.collapsedTopics.delete(topic.tag);
			} else {
				this.collapsedTopics.add(topic.tag);
			}
			this.refresh();
		});

		// Task list (hidden if collapsed)
		if (!isCollapsed) {
			const taskList = section.createDiv({ cls: "acta-task-list" });

			for (const task of topic.tasks) {
				if (!this.settings.showCompleted && task.completed) continue;
				this.renderTaskItem(taskList, task);
			}
		}
	}

	private renderTaskItem(
		parent: HTMLElement,
		task: { id: string; text: string; completed: boolean; filePath: string; fileName: string; line: number; addedAt: number }
	): void {
		const item = parent.createDiv({
			cls: `acta-task-item ${task.completed ? "is-completed" : ""}`,
		});

		const checkbox = item.createEl("input", {
			type: "checkbox",
			cls: "acta-task-checkbox task-list-item-checkbox",
		});
		(checkbox as HTMLInputElement).checked = task.completed;

		checkbox.addEventListener("click", async (e) => {
			e.preventDefault();
			const success = await this.toggler.toggleTask(task);
			if (!success) {
				console.error("Acta Task: Failed to toggle task", task.id);
			}
			// The vault.modify will trigger metadataCache changed → debounced refresh
		});

		item.createSpan({
			cls: "acta-task-text",
			text: task.text,
		});

		if (this.settings.showSourceNote) {
			const metaContainer = item.createSpan({
				cls: "acta-task-meta",
			});

			const badge = metaContainer.createSpan({
				cls: "acta-task-source-badge",
				text: task.fileName,
			});
			badge.addEventListener("click", async (e) => {
				e.stopPropagation();
				const file = this.app.vault.getAbstractFileByPath(
					task.filePath
				);
				if (file instanceof TFile) {
					await this.app.workspace.getLeaf(false).openFile(file, {
						eState: { line: task.line },
					});
				}
			});

			// Add date badge
			const date = new Date(task.addedAt);
			const dateStr = date.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			});
			metaContainer.createSpan({
				cls: "acta-task-date-badge",
				text: dateStr,
			});
		}

		// Remove button
		const removeBtn = item.createSpan({
			cls: "acta-task-remove-btn",
			text: "×",
			attr: { title: "Remove from board" },
		});
		removeBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.taskManager.removeTask(task.id);
			this.refresh();
		});
	}
}
