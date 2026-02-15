import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	ActaTaskSettings,
	ActaTaskData,
	ActaFeedbackData,
	ActaNegativeFeedbackData,
	DEFAULT_SETTINGS,
	DEFAULT_DATA,
	DEFAULT_FEEDBACK_DATA,
	DEFAULT_NEGATIVE_FEEDBACK_DATA,
	ACTA_TASK_VIEW_TYPE,
	ACTA_FEEDBACK_VIEW_TYPE,
	ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE,
	ACTA_NORTHSTAR_VIEW_TYPE,
} from "./types";
import { TaskBoardView } from "./taskBoardView";
import { FeedbackBoardView } from "./feedbackBoardView";
import { NegativeFeedbackBoardView } from "./negativeFeedbackBoardView";
import { NorthStarBoardView } from "./northStarBoardView";
import { ActaTaskSettingTab } from "./settings";
import { TaskManager } from "./taskManager";
import { TaskScanner } from "./taskScanner";
import { TaskToggler } from "./taskToggler";
import { FeedbackManager } from "./feedbackManager";
import { FeedbackScanner } from "./feedbackScanner";
import { NegativeFeedbackManager } from "./negativeFeedbackManager";
import { NegativeFeedbackScanner } from "./negativeFeedbackScanner";
import { ActaNorthStarData, DEFAULT_NORTHSTAR_DATA } from "./northStarTypes";
import { NorthStarManager } from "./northStarManager";
import { NorthStarLlmClient } from "./northStarLlmClient";
import { NorthStarObserver } from "./northStarObserver";
import { NorthStarAgent } from "./northStarAgent";

export default class ActaTaskPlugin extends Plugin {
	settings: ActaTaskSettings = DEFAULT_SETTINGS;
	data: ActaTaskData = DEFAULT_DATA;
	feedbackData: ActaFeedbackData = DEFAULT_FEEDBACK_DATA;
	negativeFeedbackData: ActaNegativeFeedbackData = DEFAULT_NEGATIVE_FEEDBACK_DATA;
	northStarData: ActaNorthStarData = { ...DEFAULT_NORTHSTAR_DATA };
	taskManager: TaskManager | null = null;
	scanner: TaskScanner | null = null;
	toggler: TaskToggler | null = null;
	feedbackManager: FeedbackManager | null = null;
	feedbackScanner: FeedbackScanner | null = null;
	negativeFeedbackManager: NegativeFeedbackManager | null = null;
	negativeFeedbackScanner: NegativeFeedbackScanner | null = null;
	northStarManager: NorthStarManager | null = null;
	northStarLlmClient: NorthStarLlmClient | null = null;
	northStarObserver: NorthStarObserver | null = null;
	northStarAgent: NorthStarAgent | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadTaskData();
		await this.loadFeedbackData();
		await this.loadNegativeFeedbackData();
		await this.loadNorthStarData();

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

		// Initialize negative feedback managers
		this.negativeFeedbackManager = new NegativeFeedbackManager(
			this.app,
			this.settings,
			this.negativeFeedbackData,
			() => this.saveNegativeFeedbackData()
		);
		this.negativeFeedbackScanner = new NegativeFeedbackScanner(
			this.app,
			this.negativeFeedbackManager,
			this.settings
		);

		// Initialize North Star
		this.northStarManager = new NorthStarManager(
			this.app,
			this.settings,
			this.northStarData,
			() => this.saveNorthStarData()
		);
		this.northStarLlmClient = new NorthStarLlmClient(this.settings);
		this.northStarObserver = new NorthStarObserver(
			this.app,
			this.settings,
			this.data,
			this.feedbackData,
			this.negativeFeedbackData
		);
		this.northStarAgent = new NorthStarAgent(
			this.northStarManager,
			this.northStarObserver,
			this.northStarLlmClient
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

		// Register negative feedback board view
		this.registerView(ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE, (leaf) => {
			return new NegativeFeedbackBoardView(
				leaf,
				this.negativeFeedbackScanner!,
				this.negativeFeedbackManager!,
				this.settings
			);
		});

		// Register North Star board view
		this.registerView(ACTA_NORTHSTAR_VIEW_TYPE, (leaf) => {
			return new NorthStarBoardView(
				leaf,
				this.northStarManager!,
				this.northStarAgent!,
				this.northStarLlmClient!,
				this.settings
			);
		});

		// Task board ribbon and commands
		this.addRibbonIcon("list-checks", "Open Northstar Board", () => {
			this.openBoard();
		});

		this.addCommand({
			id: "open-northstar-board",
			name: "Open task board",
			callback: () => this.openBoard(),
		});

		this.addCommand({
			id: "refresh-northstar-board",
			name: "Refresh task board",
			callback: () => this.refreshBoard(),
		});

		// Feedback board ribbon and commands
		this.addRibbonIcon("heart", "Open ❤️ 正反馈board", () => {
			this.openFeedbackBoard();
		});

		this.addCommand({
			id: "open-acta-feedback-board",
			name: "Open ❤️ 正反馈board",
			callback: () => this.openFeedbackBoard(),
		});

		this.addCommand({
			id: "refresh-acta-feedback-board",
			name: "Refresh ❤️ 正反馈board",
			callback: () => this.refreshFeedbackBoard(),
		});

		// Negative feedback board ribbon and commands
		this.addRibbonIcon("frown", "Open 😒 负反馈board", () => {
			this.openNegativeFeedbackBoard();
		});

		this.addCommand({
			id: "open-acta-negative-feedback-board",
			name: "Open 😒 负反馈board",
			callback: () => this.openNegativeFeedbackBoard(),
		});

		this.addCommand({
			id: "refresh-acta-negative-feedback-board",
			name: "Refresh 😒 负反馈board",
			callback: () => this.refreshNegativeFeedbackBoard(),
		});

		// North Star board ribbon and commands
		this.addRibbonIcon("star", "Open North Star board", () => {
			this.openNorthStarBoard();
		});

		this.addCommand({
			id: "open-acta-northstar-board",
			name: "Open North Star board",
			callback: () => this.openNorthStarBoard(),
		});

		this.addCommand({
			id: "refresh-acta-northstar-board",
			name: "Refresh North Star board",
			callback: () => this.refreshNorthStarBoard(),
		});

		this.addSettingTab(new ActaTaskSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(ACTA_TASK_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(ACTA_FEEDBACK_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE);
		this.app.workspace.detachLeavesOfType(ACTA_NORTHSTAR_VIEW_TYPE);
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
			negativeFeedback: this.negativeFeedbackData,
			northStar: this.northStarData,
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
		if (this.negativeFeedbackManager) {
			this.negativeFeedbackManager.updateSettings(this.settings);
		}
		if (this.negativeFeedbackScanner) {
			this.negativeFeedbackScanner.updateSettings(this.settings);
		}
		if (this.northStarManager) {
			this.northStarManager.updateSettings(this.settings);
		}
		if (this.northStarLlmClient) {
			this.northStarLlmClient.updateSettings(this.settings);
		}
		if (this.northStarObserver) {
			this.northStarObserver.updateSettings(this.settings);
		}
		const northStarView = this.getActiveNorthStarView();
		if (northStarView) northStarView.updateSettings(this.settings);
		const taskView = this.getActiveTaskView();
		if (taskView) taskView.updateSettings(this.settings);
		const feedbackView = this.getActiveFeedbackView();
		if (feedbackView) feedbackView.updateSettings(this.settings);
		const negativeFeedbackView = this.getActiveNegativeFeedbackView();
		if (negativeFeedbackView) negativeFeedbackView.updateSettings(this.settings);
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
			negativeFeedback: this.negativeFeedbackData,
			northStar: this.northStarData,
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
			negativeFeedback: this.negativeFeedbackData,
			northStar: this.northStarData,
		});
	}

	async loadNegativeFeedbackData(): Promise<void> {
		const data = await this.loadData();
		this.negativeFeedbackData = Object.assign(
			{},
			DEFAULT_NEGATIVE_FEEDBACK_DATA,
			data?.negativeFeedback
		);
	}

	async saveNegativeFeedbackData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			tasks: this.data,
			feedback: this.feedbackData,
			negativeFeedback: this.negativeFeedbackData,
			northStar: this.northStarData,
		});
	}

	async loadNorthStarData(): Promise<void> {
		const data = await this.loadData();
		const raw = data?.northStar;
		this.northStarData = Object.assign(
			{},
			DEFAULT_NORTHSTAR_DATA,
			raw
		);
		// Ensure nested defaults
		if (!this.northStarData.archivedGoals) {
			this.northStarData.archivedGoals = [];
		}
		// tinkerMessages is now per-goal (legacy shared field handled by manager migration)
		if (!this.northStarData.goalContexts) {
			this.northStarData.goalContexts = [];
		}

		// Migrate legacy single-goal data to goalContexts
		if (raw?.goal && !raw.goalContexts) {
			const legacyGoal = raw.goal;
			const legacyPolicy = raw.policy || { ...DEFAULT_NORTHSTAR_DATA };
			const legacyAssessments: import("./northStarTypes").Assessment[] = raw.assessments || [];

			// Backfill goalId on legacy assessments
			for (const a of legacyAssessments) {
				if (!a.goalId) {
					a.goalId = legacyGoal.id;
				}
			}

			this.northStarData.goalContexts = [{
				goal: legacyGoal,
				policy: legacyPolicy,
				assessments: legacyAssessments,
				tinkerMessages: [],
			}];

			// Clean up legacy fields
			delete this.northStarData.goal;
			delete this.northStarData.policy;
			delete this.northStarData.assessments;
		}
	}

	async saveNorthStarData(): Promise<void> {
		await this.saveData({
			settings: this.settings,
			tasks: this.data,
			feedback: this.feedbackData,
			negativeFeedback: this.negativeFeedbackData,
			northStar: this.northStarData,
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

	private getActiveNegativeFeedbackView(): NegativeFeedbackBoardView | null {
		const leaves = this.app.workspace.getLeavesOfType(
			ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE
		);
		if (leaves.length > 0) {
			return leaves[0].view as NegativeFeedbackBoardView;
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

	private refreshNegativeFeedbackBoard(): void {
		const view = this.getActiveNegativeFeedbackView();
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

	private async openNegativeFeedbackBoard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(
			ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE
		);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}

	private getActiveNorthStarView(): NorthStarBoardView | null {
		const leaves = this.app.workspace.getLeavesOfType(
			ACTA_NORTHSTAR_VIEW_TYPE
		);
		if (leaves.length > 0) {
			return leaves[0].view as NorthStarBoardView;
		}
		return null;
	}

	private refreshNorthStarBoard(): void {
		const view = this.getActiveNorthStarView();
		if (view) view.refresh();
	}

	private async openNorthStarBoard(): Promise<void> {
		const existing = this.app.workspace.getLeavesOfType(
			ACTA_NORTHSTAR_VIEW_TYPE
		);
		if (existing.length > 0) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf) {
			await leaf.setViewState({
				type: ACTA_NORTHSTAR_VIEW_TYPE,
				active: true,
			});
			this.app.workspace.revealLeaf(leaf);
		}
	}
}
