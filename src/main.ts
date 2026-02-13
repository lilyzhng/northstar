import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	ActaTaskSettings,
	ActaTaskData,
	ActaFeedbackData,
	DEFAULT_SETTINGS,
	DEFAULT_DATA,
	DEFAULT_FEEDBACK_DATA,
	ACTA_TASK_VIEW_TYPE,
	ACTA_FEEDBACK_VIEW_TYPE,
} from "./types";
import { TaskBoardView } from "./taskBoardView";
import { FeedbackBoardView } from "./feedbackBoardView";
import { ActaTaskSettingTab } from "./settings";
import { TaskManager } from "./taskManager";
import { TaskScanner } from "./taskScanner";
import { TaskToggler } from "./taskToggler";
import { FeedbackManager } from "./feedbackManager";
import { FeedbackScanner } from "./feedbackScanner";

export default class ActaTaskPlugin extends Plugin {
	settings: ActaTaskSettings = DEFAULT_SETTINGS;
	data: ActaTaskData = DEFAULT_DATA;
	feedbackData: ActaFeedbackData = DEFAULT_FEEDBACK_DATA;
	taskManager: TaskManager | null = null;
	scanner: TaskScanner | null = null;
	toggler: TaskToggler | null = null;
	feedbackManager: FeedbackManager | null = null;
	feedbackScanner: FeedbackScanner | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadTaskData();
		await this.loadFeedbackData();

		// Initialize task managers
		this.taskManager = new TaskManager(
			this.app,
			this.settings,
			this.data,
			() => this.saveTaskData()
		);
		this.scanner = new TaskScanner(this.app, this.taskManager, this.settings);
		this.toggler = new TaskToggler(this.app);

		// Initialize feedback managers
		this.feedbackManager = new FeedbackManager(
			this.app,
			this.settings,
			this.feedbackData,
			() => this.saveFeedbackData()
		);
		this.feedbackScanner = new FeedbackScanner(
			this.app,
			this.feedbackManager,
			this.settings
		);

		// Register task board view
		this.registerView(ACTA_TASK_VIEW_TYPE, (leaf) => {
			return new TaskBoardView(
				leaf,
				this.scanner!,
				this.toggler!,
				this.taskManager!,
				this.settings
			);
		});

		// Register feedback board view
		this.registerView(ACTA_FEEDBACK_VIEW_TYPE, (leaf) => {
			return new FeedbackBoardView(
				leaf,
				this.feedbackScanner!,
				this.feedbackManager!,
				this.settings
			);
		});

		// Task board ribbon and commands
		this.addRibbonIcon("list-checks", "Open Acta Task Board", () => {
			this.openBoard();
		});

		this.addCommand({
			id: "open-acta-task-board",
			name: "Open task board",
			callback: () => this.openBoard(),
		});

		this.addCommand({
			id: "refresh-acta-task-board",
			name: "Refresh task board",
			callback: () => this.refreshBoard(),
		});

		// Feedback board ribbon and commands
		this.addRibbonIcon("heart", "Open 正反馈 Board", () => {
			this.openFeedbackBoard();
		});

		this.addCommand({
			id: "open-acta-feedback-board",
			name: "Open 正反馈 board",
			callback: () => this.openFeedbackBoard(),
		});

		this.addCommand({
			id: "refresh-acta-feedback-board",
			name: "Refresh 正反馈 board",
			callback: () => this.refreshFeedbackBoard(),
		});

		this.addSettingTab(new ActaTaskSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(ACTA_TASK_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(ACTA_FEEDBACK_VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
	}

	async saveSettings(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			tasks: this.data,
			feedback: this.feedbackData,
		});
		// Propagate settings to managers and views
		if (this.taskManager) {
			this.taskManager.updateSettings(this.settings);
		}
		if (this.scanner) {
			this.scanner.updateSettings(this.settings);
		}
		if (this.feedbackManager) {
			this.feedbackManager.updateSettings(this.settings);
		}
		if (this.feedbackScanner) {
			this.feedbackScanner.updateSettings(this.settings);
		}
		const taskView = this.getActiveTaskView();
		if (taskView) taskView.updateSettings(this.settings);
		const feedbackView = this.getActiveFeedbackView();
		if (feedbackView) feedbackView.updateSettings(this.settings);
		// Force editor refresh for new marker emoji
		this.app.workspace.updateOptions();
	}

	async loadTaskData(): Promise<void> {
		const data = await this.loadData();
		this.data = Object.assign({}, DEFAULT_DATA, data?.tasks);
	}

	async saveTaskData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			tasks: this.data,
			feedback: this.feedbackData,
		});
	}

	async loadFeedbackData(): Promise<void> {
		const data = await this.loadData();
		this.feedbackData = Object.assign(
			{},
			DEFAULT_FEEDBACK_DATA,
			data?.feedback
		);
	}

	async saveFeedbackData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			tasks: this.data,
			feedback: this.feedbackData,
		});
	}

	private getActiveTaskView(): TaskBoardView | null {
		const leaves = this.app.workspace.getLeavesOfType(
			ACTA_TASK_VIEW_TYPE
		);
		if (leaves.length > 0) {
			return leaves[0].view as TaskBoardView;
		}
		return null;
	}

	private getActiveFeedbackView(): FeedbackBoardView | null {
		const leaves = this.app.workspace.getLeavesOfType(
			ACTA_FEEDBACK_VIEW_TYPE
		);
		if (leaves.length > 0) {
			return leaves[0].view as FeedbackBoardView;
		}
		return null;
	}

	private refreshBoard(): void {
		const view = this.getActiveTaskView();
		if (view) view.refresh();
	}

	private refreshFeedbackBoard(): void {
		const view = this.getActiveFeedbackView();
		if (view) view.refresh();
	}

	private async openBoard(): Promise<void> {
		const existing =
			this.app.workspace.getLeavesOfType(ACTA_TASK_VIEW_TYPE);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: ACTA_TASK_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	private async openFeedbackBoard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(
			ACTA_FEEDBACK_VIEW_TYPE
		);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: ACTA_FEEDBACK_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}
}
