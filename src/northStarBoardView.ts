import { ItemView, WorkspaceLeaf, Notice } from "obsidian";
import { ActaTaskSettings, ACTA_NORTHSTAR_VIEW_TYPE } from "./types";
import { NorthStarManager } from "./northStarManager";
import { NorthStarAgent } from "./northStarAgent";
import { NorthStarGoalModal } from "./northStarGoalModal";
import { Assessment, SignalBreakdownItem } from "./northStarTypes";

interface CycleStep {
	id: string;
	label: string;
	status: "pending" | "running" | "done";
	detail: string;
}

export class NorthStarBoardView extends ItemView {
	private manager: NorthStarManager;
	private agent: NorthStarAgent;
	private settings: ActaTaskSettings;
	private boardEl: HTMLDivElement | null = null;
	private isRunning = false;

	constructor(
		leaf: WorkspaceLeaf,
		manager: NorthStarManager,
		agent: NorthStarAgent,
		settings: ActaTaskSettings
	) {
		super(leaf);
		this.manager = manager;
		this.agent = agent;
		this.settings = settings;
	}

	getViewType(): string {
		return ACTA_NORTHSTAR_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "North Star";
	}

	getIcon(): string {
		return "star";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("acta-task-container");

		this.boardEl = container.createDiv({ cls: "acta-northstar-board" });
		this.renderBoard();
	}

	async onClose(): Promise<void> {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	refresh(): void {
		if (!this.isRunning) {
			this.renderBoard();
		}
	}

	private renderBoard(): void {
		if (!this.boardEl) return;
		this.boardEl.empty();

		const goal = this.manager.getGoal();

		this.renderHeader();

		if (!goal) {
			this.renderEmptyGoalState();
			return;
		}

		this.renderGoalCard();

		const latest = this.manager.getLatestAssessment();
		if (!latest) {
			this.renderNoAssessmentState();
			return;
		}

		this.renderScoreDisplay(latest);
		this.renderSignalBreakdown(latest);
		this.renderDriftIndicators(latest);
		this.renderMomentumIndicators(latest);
	}

	private renderHeader(): void {
		if (!this.boardEl) return;

		const header = this.boardEl.createDiv({ cls: "acta-northstar-header" });
		const titleRow = header.createDiv({ cls: "acta-northstar-title-row" });

		titleRow.createEl("h4", { text: "North Star" });

		const btnGroup = titleRow.createDiv({ cls: "acta-northstar-btn-group" });

		const goal = this.manager.getGoal();
		if (goal) {
			const runBtn = btnGroup.createEl("button", {
				cls: "acta-northstar-run-btn clickable-icon",
				attr: { "aria-label": "Run Cycle" },
			});
			runBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
			runBtn.addEventListener("click", () => this.runCycle());
		}

		const refreshBtn = btnGroup.createEl("button", {
			cls: "acta-northstar-refresh-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
		refreshBtn.addEventListener("click", () => this.refresh());
	}

	private renderEmptyGoalState(): void {
		if (!this.boardEl) return;

		const empty = this.boardEl.createDiv({ cls: "acta-northstar-empty" });
		empty.createEl("p", { text: "No goal set yet." });

		const setBtn = empty.createEl("button", {
			cls: "acta-northstar-set-goal-btn",
			text: "Set Your North Star",
		});
		setBtn.addEventListener("click", () => this.openGoalModal());
	}

	private renderNoAssessmentState(): void {
		if (!this.boardEl) return;

		const empty = this.boardEl.createDiv({ cls: "acta-northstar-no-assessment" });
		empty.createEl("p", { text: "No assessment yet. Click the play button to run your first cycle." });

		if (!this.settings.anthropicApiKey) {
			empty.createEl("p", {
				text: "Set your Anthropic API key in Settings → Acta Task → North Star first.",
				cls: "acta-northstar-warning",
			});
		}
	}

	private renderGoalCard(): void {
		if (!this.boardEl) return;
		const goal = this.manager.getGoal();
		if (!goal) return;

		const card = this.boardEl.createDiv({ cls: "acta-northstar-goal-card" });

		const goalText = card.createDiv({ cls: "acta-northstar-goal-text" });
		goalText.createEl("span", { text: goal.text });

		const badges = card.createDiv({ cls: "acta-northstar-goal-badges" });

		const dayNum = this.manager.getDayNumber();
		badges.createEl("span", {
			cls: "acta-northstar-badge",
			text: `Day ${dayNum} of ${goal.timeWindowDays}`,
		});

		badges.createEl("span", {
			cls: "acta-northstar-badge acta-northstar-badge-phase",
			text: goal.currentPhase,
		});

		const daysLeft = this.manager.getDaysLeft();
		badges.createEl("span", {
			cls: `acta-northstar-badge ${daysLeft <= 7 ? "acta-northstar-badge-urgent" : ""}`,
			text: `${daysLeft}d left`,
		});
	}

	private renderScoreDisplay(assessment: Assessment): void {
		if (!this.boardEl) return;

		const scoreSection = this.boardEl.createDiv({ cls: "acta-northstar-score-section" });

		const scoreEl = scoreSection.createDiv({ cls: "acta-northstar-score" });
		const scoreNum = scoreEl.createEl("span", {
			cls: "acta-northstar-score-number",
			text: `${assessment.overallScore}`,
		});

		if (assessment.overallScore >= 70) {
			scoreNum.addClass("acta-northstar-score-good");
		} else if (assessment.overallScore >= 40) {
			scoreNum.addClass("acta-northstar-score-mid");
		} else {
			scoreNum.addClass("acta-northstar-score-low");
		}

		scoreEl.createEl("span", {
			cls: "acta-northstar-score-label",
			text: "/100",
		});

		scoreSection.createDiv({
			cls: "acta-northstar-score-date",
			text: `Day ${assessment.dayNumber} — ${assessment.date}`,
		});
	}

	private renderSignalBreakdown(assessment: Assessment): void {
		if (!this.boardEl) return;

		const section = this.boardEl.createDiv({ cls: "acta-northstar-breakdown" });
		section.createEl("h5", { text: "Signal Breakdown" });

		for (const signal of assessment.signalBreakdown) {
			this.renderSignalBar(section, signal);
		}
	}

	private renderSignalBar(parent: HTMLElement, signal: SignalBreakdownItem): void {
		const row = parent.createDiv({ cls: "acta-northstar-signal-row" });

		const labelRow = row.createDiv({ cls: "acta-northstar-signal-label-row" });
		labelRow.createEl("span", {
			cls: "acta-northstar-signal-name",
			text: this.formatCategoryName(signal.category),
		});
		labelRow.createEl("span", {
			cls: "acta-northstar-signal-score",
			text: `${Math.round(signal.score)}/${Math.round(signal.maxScore)}`,
		});

		const barContainer = row.createDiv({ cls: "acta-northstar-bar-container" });
		const bar = barContainer.createDiv({ cls: "acta-northstar-bar" });
		const pct = signal.maxScore > 0 ? (signal.score / signal.maxScore) * 100 : 0;
		bar.style.width = `${Math.min(100, Math.max(0, pct))}%`;

		if (pct >= 70) bar.addClass("acta-northstar-bar-good");
		else if (pct >= 40) bar.addClass("acta-northstar-bar-mid");
		else bar.addClass("acta-northstar-bar-low");

		if (signal.reasoning) {
			row.createDiv({
				cls: "acta-northstar-signal-reasoning",
				text: signal.reasoning,
			});
		}
	}

	private renderDriftIndicators(assessment: Assessment): void {
		if (!this.boardEl || assessment.driftIndicators.length === 0) return;

		const section = this.boardEl.createDiv({ cls: "acta-northstar-drift" });
		section.createEl("h5", { text: "Drift Indicators" });

		for (const drift of assessment.driftIndicators) {
			section.createDiv({
				cls: "acta-northstar-drift-item",
				text: drift,
			});
		}
	}

	private renderMomentumIndicators(assessment: Assessment): void {
		if (!this.boardEl || assessment.momentumIndicators.length === 0) return;

		const section = this.boardEl.createDiv({ cls: "acta-northstar-momentum" });
		section.createEl("h5", { text: "Momentum Indicators" });

		for (const momentum of assessment.momentumIndicators) {
			section.createDiv({
				cls: "acta-northstar-momentum-item",
				text: momentum,
			});
		}
	}

	private formatCategoryName(category: string): string {
		const names: Record<string, string> = {
			goalDirectDeepWork: "Goal-Direct Deep Work",
			taskCompletion: "Task Completion",
			reflectionDepth: "Reflection Depth",
			pipelineActivity: "Pipeline Activity",
			feedbackSignals: "Feedback Signals",
		};
		return names[category] || category;
	}

	private openGoalModal(): void {
		new NorthStarGoalModal(this.app, async (text, days) => {
			await this.manager.setGoal(text, days);
			new Notice("North Star goal locked in!");
			this.renderBoard();
		}).open();
	}

	// ── Live activity log for the cycle ──

	private async runCycle(): Promise<void> {
		if (this.isRunning) return;

		if (!this.settings.anthropicApiKey) {
			new Notice("Set your Anthropic API key in Settings → Acta Task first.");
			return;
		}

		this.isRunning = true;

		// Build the step list UI
		const steps: CycleStep[] = [
			{ id: "tasks",             label: "Task board",          status: "pending", detail: "" },
			{ id: "positive-feedback", label: "Positive feedback",   status: "pending", detail: "" },
			{ id: "negative-feedback", label: "Negative feedback",   status: "pending", detail: "" },
			{ id: "reflections",       label: "#northstar notes",    status: "pending", detail: "" },
			{ id: "vault",             label: "Vault activity",      status: "pending", detail: "" },
			{ id: "assess",            label: "LLM assessment",      status: "pending", detail: "" },
			{ id: "save",              label: "Save",                status: "pending", detail: "" },
		];
		const stepEls = this.renderCycleLog(steps);

		try {
			const today = new Date();
			const dateStr = today.toISOString().split("T")[0];

			await this.agent.runCycle(dateStr, (stepId, status, detail) => {
				const step = steps.find(s => s.id === stepId);
				if (!step) return;
				step.status = status;
				step.detail = detail;
				this.updateStepEl(stepEls, step);
			});

			new Notice("North Star cycle complete!");
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Unknown error";
			new Notice(`Cycle failed: ${msg}`);
			console.error("North Star cycle error:", e);

			// Mark any still-running step as failed
			for (const step of steps) {
				if (step.status === "running") {
					step.status = "done";
					step.detail = `Failed: ${msg}`;
					this.updateStepEl(stepEls, step, true);
				}
			}
		}

		// Brief pause so user can see the completed log before dashboard renders
		await new Promise(r => setTimeout(r, 1500));
		this.isRunning = false;
		this.renderBoard();
	}

	private renderCycleLog(steps: CycleStep[]): Map<string, HTMLDivElement> {
		if (!this.boardEl) return new Map();

		// Remove everything below the goal card
		const selectors = [
			".acta-northstar-score-section",
			".acta-northstar-breakdown",
			".acta-northstar-drift",
			".acta-northstar-momentum",
			".acta-northstar-no-assessment",
			".acta-northstar-loading",
			".acta-northstar-cycle-log",
		];
		for (const sel of selectors) {
			const el = this.boardEl.querySelector(sel);
			if (el) el.remove();
		}

		const logContainer = this.boardEl.createDiv({ cls: "acta-northstar-cycle-log" });
		logContainer.createEl("h5", { text: "OBSERVE + ASSESS" });

		const stepEls = new Map<string, HTMLDivElement>();

		for (const step of steps) {
			const row = logContainer.createDiv({ cls: "acta-northstar-step" });
			row.addClass("acta-northstar-step-pending");

			const indicator = row.createSpan({ cls: "acta-northstar-step-indicator" });
			indicator.textContent = "\u25CB"; // ○

			const content = row.createDiv({ cls: "acta-northstar-step-content" });
			content.createSpan({ cls: "acta-northstar-step-label", text: step.label });
			content.createSpan({ cls: "acta-northstar-step-detail" });

			stepEls.set(step.id, row);
		}

		return stepEls;
	}

	private updateStepEl(stepEls: Map<string, HTMLDivElement>, step: CycleStep, failed = false): void {
		const row = stepEls.get(step.id);
		if (!row) return;

		const indicator = row.querySelector(".acta-northstar-step-indicator");
		const detail = row.querySelector(".acta-northstar-step-detail");

		row.removeClass("acta-northstar-step-pending", "acta-northstar-step-running", "acta-northstar-step-done", "acta-northstar-step-failed");

		if (failed) {
			row.addClass("acta-northstar-step-failed");
			if (indicator) indicator.textContent = "\u2717"; // ✗
		} else if (step.status === "running") {
			row.addClass("acta-northstar-step-running");
			if (indicator) indicator.textContent = "\u25CF"; // ●
		} else if (step.status === "done") {
			row.addClass("acta-northstar-step-done");
			if (indicator) indicator.textContent = "\u2713"; // ✓
		} else {
			row.addClass("acta-northstar-step-pending");
			if (indicator) indicator.textContent = "\u25CB"; // ○
		}

		if (detail) detail.textContent = step.detail ? ` — ${step.detail}` : "";
	}
}
