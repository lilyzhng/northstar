import { Plugin, WorkspaceLeaf } from "obsidian";
import {
	ActaTaskSettings,
	ActaTaskData,
	DEFAULT_SETTINGS,
	DEFAULT_DATA,
	ACTA_TASK_VIEW_TYPE,
} from "./types";
import { TaskBoardView } from "./taskBoardView";
import { ActaTaskSettingTab } from "./settings";
import { TaskManager } from "./taskManager";
import { TaskScanner } from "./taskScanner";
import { TaskToggler } from "./taskToggler";

export default class ActaTaskPlugin extends Plugin {
	settings: ActaTaskSettings = DEFAULT_SETTINGS;
	data: ActaTaskData = DEFAULT_DATA;
	taskManager: TaskManager | null = null;
	scanner: TaskScanner | null = null;
	toggler: TaskToggler | null = null;

	async onload(): Promise<void> {
		await this.loadSettings();
		await this.loadTaskData();

		// Initialize managers
		this.taskManager = new TaskManager(
			this.app,
			this.settings,
			this.data,
			() => this.saveTaskData()
		);
		this.scanner = new TaskScanner(this.app, this.taskManager, this.settings);
		this.toggler = new TaskToggler(this.app);

		this.registerView(ACTA_TASK_VIEW_TYPE, (leaf) => {
			return new TaskBoardView(
				leaf,
				this.scanner!,
				this.toggler!,
				this.taskManager!,
				this.settings
			);
		});

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

		this.addSettingTab(new ActaTaskSettingTab(this.app, this));
	}

	async onunload(): Promise<void> {
		this.app.workspace.detachLeavesOfType(ACTA_TASK_VIEW_TYPE);
	}

	async loadSettings(): Promise<void> {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
	}

	async saveSettings(): Promise<void> {
		await this.saveData({ settings: this.settings, tasks: this.data });
		// Propagate settings to managers and views
		if (this.taskManager) {
			this.taskManager.updateSettings(this.settings);
		}
		if (this.scanner) {
			this.scanner.updateSettings(this.settings);
		}
		const view = this.getActiveView();
		if (view) view.updateSettings(this.settings);
		// Force editor refresh for new marker emoji
		this.app.workspace.updateOptions();
	}

	async loadTaskData(): Promise<void> {
		const data = await this.loadData();
		this.data = Object.assign({}, DEFAULT_DATA, data?.tasks);
	}

	async saveTaskData(): Promise<void> {
		await this.saveData({ settings: this.settings, tasks: this.data });
	}

	private getActiveView(): TaskBoardView | null {
		const leaves = this.app.workspace.getLeavesOfType(
			ACTA_TASK_VIEW_TYPE
		);
		if (leaves.length > 0) {
			return leaves[0].view as TaskBoardView;
		}
		return null;
	}

	private refreshBoard(): void {
		const view = this.getActiveView();
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
}
