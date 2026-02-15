import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer, TFile } from "obsidian";
import { ActaTaskSettings, ACTA_NORTHSTAR_VIEW_TYPE } from "./types";
import { NorthStarManager } from "./northStarManager";
import { NorthStarAgent } from "./northStarAgent";
import { NorthStarLlmClient } from "./northStarLlmClient";
import { NorthStarGoalModal, NorthStarEditContextModal } from "./northStarGoalModal";
import {
	Assessment,
	NorthStarGoal,
	TinkerMessage,
	DaySignals,
	ApiMessage,
	ContentBlock,
	ToolDefinition,
	ToolUseBlock,
	TextBlock,
} from "./northStarTypes";

// ── Tool definitions ──

const TOOL_DEFINITIONS: ToolDefinition[] = [
	{
		name: "get_today_date",
		description: "Get date info, day number for the current goal, and whether a check-in already exists. Always call this first before observe_signals or run_assessment. Pass a date to query a specific day (e.g. yesterday), or omit for today.",
		input_schema: {
			type: "object",
			properties: {
				date: {
					type: "string",
					description: "Optional date in YYYY-MM-DD format. If omitted, returns today's date. Use this when the user wants to check in for a different day (e.g. yesterday).",
				},
			},
			required: [],
		},
	},
	{
		name: "observe_signals",
		description: "Scan the vault for signals on a given date: tasks, feedback, reflections, and vault activity. Call get_today_date first, then pass the date here.",
		input_schema: {
			type: "object",
			properties: {
				date: {
					type: "string",
					description: "The date to observe in YYYY-MM-DD format (from get_today_date)",
				},
			},
			required: ["date"],
		},
	},
	{
		name: "run_assessment",
		description: "Run LLM alignment assessment on collected signals for the current goal. Call observe_signals first. Pass the same date.",
		input_schema: {
			type: "object",
			properties: {
				date: {
					type: "string",
					description: "The date for this assessment in YYYY-MM-DD format (from get_today_date)",
				},
			},
			required: ["date"],
		},
	},
	{
		name: "save_conversation_summary",
		description: "Summarize the current Tinker conversation and append it to today's check-in note. Call this when the user asks to summarize, capture takeaways, or save conversation notes. Write the summary in markdown with key insights, action items, and decisions.",
		input_schema: {
			type: "object",
			properties: {
				date: {
					type: "string",
					description: "The date of the check-in note to append to, in YYYY-MM-DD format (from get_today_date)",
				},
				summary: {
					type: "string",
					description: "The conversation summary in markdown. Include: key insights, action items, and any decisions made. Use bullet points and keep it concise. If rewriting an existing summary, produce a single unified summary that merges old and new insights.",
				},
				overwrite: {
					type: "boolean",
					description: "Set to true when rewriting an existing summary with merged content. On first call, omit this — the tool will return existing content for you to merge.",
				},
			},
			required: ["date", "summary"],
		},
	},
	{
		name: "get_assessment_history",
		description: "Retrieve past assessments for trend analysis for the current goal.",
		input_schema: {
			type: "object",
			properties: {
				count: {
					type: "number",
					description: "Number of recent assessments to retrieve (default 5)",
				},
			},
			required: [],
		},
	},
];

export class NorthStarBoardView extends ItemView {
	private manager: NorthStarManager;
	private agent: NorthStarAgent;
	private llmClient: NorthStarLlmClient;
	private settings: ActaTaskSettings;
	private boardEl: HTMLDivElement | null = null;
	private isSending = false;
	private chatMessagesEl: HTMLDivElement | null = null;
	private lastObservedSignals: DaySignals | null = null;
	private activeGoalId: string | null = null;

	// @ mention state
	private referencedFiles: TFile[] = [];
	private mentionDropdownEl: HTMLDivElement | null = null;
	private mentionQuery = "";
	private mentionStartIndex = -1;
	private mentionSelectedIndex = 0;
	private mentionFilteredFiles: TFile[] = [];
	private fileChipsEl: HTMLDivElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		manager: NorthStarManager,
		agent: NorthStarAgent,
		llmClient: NorthStarLlmClient,
		settings: ActaTaskSettings
	) {
		super(leaf);
		this.manager = manager;
		this.agent = agent;
		this.llmClient = llmClient;
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
		container.addClass("northstar-container");

		// Restore persisted active goal
		this.activeGoalId = this.manager.getActiveGoalId();

		this.boardEl = container.createDiv({ cls: "acta-northstar-board" });
		this.renderBoard();
	}

	async onClose(): Promise<void> {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	refresh(): void {
		if (!this.isSending) {
			this.renderBoard();
		}
	}

	private getLocalDateStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	private getYesterdayDateStr(): string {
		const d = new Date();
		d.setDate(d.getDate() - 1);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	}

	private renderBoard(): void {
		if (!this.boardEl) return;
		this.boardEl.empty();
		this.chatMessagesEl = null;

		const goals = this.manager.getGoals();

		this.renderHeader();

		if (goals.length === 0) {
			this.activeGoalId = null;
			this.renderEmptyGoalState();
			return;
		}

		// Ensure activeGoalId is valid
		if (!this.activeGoalId || !goals.find(g => g.id === this.activeGoalId)) {
			this.activeGoalId = goals[0].id;
		}

		this.renderGoalsSection(goals);

		// Chat always shown when goals exist, scoped to active goal
		this.renderTinkerChat();
	}

	private renderHeader(): void {
		if (!this.boardEl) return;

		const header = this.boardEl.createDiv({ cls: "acta-northstar-header" });
		const titleRow = header.createDiv({ cls: "acta-northstar-title-row" });

		titleRow.createEl("h4", { text: "North Star" });

		const btnGroup = titleRow.createDiv({ cls: "acta-northstar-btn-group" });

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

	private switchActiveGoal(goalId: string): void {
		this.activeGoalId = goalId;
		this.manager.setActiveGoalId(goalId);
		this.renderBoard();
	}

	private renderGoalsSection(goals: NorthStarGoal[]): void {
		if (!this.boardEl) return;

		const section = this.boardEl.createDiv({ cls: "acta-northstar-goals-section" });

		const activeIndex = goals.findIndex(g => g.id === this.activeGoalId);
		const currentIndex = activeIndex >= 0 ? activeIndex : 0;
		const activeGoal = goals[currentIndex];

		// Carousel wrapper: [<] [goal card] [>]
		const carousel = section.createDiv({ cls: "acta-northstar-goal-carousel" });

		// Left arrow
		const leftArrow = carousel.createEl("button", {
			cls: "acta-northstar-carousel-arrow",
			text: "\u2039",
			attr: { "aria-label": "Previous goal" },
		});
		leftArrow.disabled = currentIndex === 0;
		leftArrow.addEventListener("click", () => {
			if (currentIndex > 0 && !this.isSending) {
				this.switchActiveGoal(goals[currentIndex - 1].id);
			}
		});

		// Single goal card (always rendered as active)
		const cardWrapper = carousel.createDiv({ cls: "acta-northstar-carousel-card-wrapper" });
		this.renderGoalCard(cardWrapper, activeGoal);

		// Right arrow
		const rightArrow = carousel.createEl("button", {
			cls: "acta-northstar-carousel-arrow",
			text: "\u203A",
			attr: { "aria-label": "Next goal" },
		});
		rightArrow.disabled = currentIndex === goals.length - 1;
		rightArrow.addEventListener("click", () => {
			if (currentIndex < goals.length - 1 && !this.isSending) {
				this.switchActiveGoal(goals[currentIndex + 1].id);
			}
		});

		// Dot indicators (only if more than 1 goal)
		if (goals.length > 1) {
			const dots = section.createDiv({ cls: "acta-northstar-carousel-dots" });
			for (let i = 0; i < goals.length; i++) {
				const dot = dots.createDiv({
					cls: `acta-northstar-carousel-dot${i === currentIndex ? " is-active" : ""}`,
				});
				dot.addEventListener("click", () => {
					if (i !== currentIndex && !this.isSending) {
						this.switchActiveGoal(goals[i].id);
					}
				});
			}
		}

		// Show "+" button when under the max
		if (this.manager.canAddGoal()) {
			const addBtn = section.createDiv({ cls: "acta-northstar-add-goal-btn" });
			addBtn.textContent = "+";
			addBtn.setAttribute("aria-label", "Add another goal");
			addBtn.addEventListener("click", () => this.openGoalModal());
		}
	}

	private renderGoalCard(parent: HTMLElement, goal: NorthStarGoal): void {
		const isActive = goal.id === this.activeGoalId;
		const card = parent.createDiv({ cls: `acta-northstar-goal-card${isActive ? " is-active" : ""}` });

		card.addEventListener("click", () => {
			if (this.activeGoalId !== goal.id && !this.isSending) {
				this.switchActiveGoal(goal.id);
			}
		});

		const goalText = card.createDiv({ cls: "acta-northstar-goal-text" });
		goalText.createEl("span", { text: goal.text });

		const badges = card.createDiv({ cls: "acta-northstar-goal-badges" });

		const dayNum = this.manager.getDayNumber(goal.id);
		badges.createEl("span", {
			cls: "acta-northstar-badge",
			text: `Day ${dayNum} of ${goal.timeWindowDays}`,
		});

		badges.createEl("span", {
			cls: "acta-northstar-badge acta-northstar-badge-phase",
			text: goal.currentPhase,
		});

		const daysLeft = this.manager.getDaysLeft(goal.id);
		badges.createEl("span", {
			cls: `acta-northstar-badge ${daysLeft <= 7 ? "acta-northstar-badge-urgent" : ""}`,
			text: `${daysLeft}d left`,
		});

		const contextLink = badges.createEl("span", {
			cls: "acta-northstar-goal-context-link",
			text: goal.context ? "edit context" : "+ Add context",
			attr: { "aria-label": goal.context ? "Edit context" : "Add reference context" },
		});
		contextLink.addEventListener("click", (e) => {
			e.stopPropagation();
			this.openEditContextModal(goal);
		});
	}

	private formatCategoryName(category: string): string {
		const names: Record<string, string> = {
			goalDirectDeepWork: "Focused Deep Work",
			taskCompletion: "Task Completion",
			reflectionDepth: "Reflection Depth",
			pipelineActivity: "Pipeline Activity",
			feedbackSignals: "Feedback Signals",
		};
		return names[category] || category;
	}

	private openGoalModal(): void {
		new NorthStarGoalModal(this.app, async (text, days, context) => {
			await this.manager.addGoal(text, days, context || undefined);
			new Notice("North Star goal locked in!");
			this.renderBoard();
		}).open();
	}

	private openEditContextModal(goal: NorthStarGoal): void {
		new NorthStarEditContextModal(this.app, goal.context || "", async (context) => {
			await this.manager.updateGoalContext(goal.id, context);
			new Notice(context ? "Goal context updated!" : "Goal context cleared.");
			this.renderBoard();
		}).open();
	}

	// ── Check-in note creation ──

	private async createCheckInNote(assessment: Assessment, goal: NorthStarGoal): Promise<void> {
		const folderPath = "NorthStar/check-ins";
		// Include a short goal ID suffix when multiple goals exist
		const goalSuffix = this.manager.getGoals().length > 1
			? ` (${goal.id.slice(-6)})`
			: "";
		const filePath = `${folderPath}/North Star Check-in — ${assessment.date}${goalSuffix}.md`;

		// Ensure folder exists
		if (!this.app.vault.getAbstractFileByPath(folderPath)) {
			await this.app.vault.createFolder(folderPath);
		}

		const scoreColor = (pct: number) =>
			pct >= 70 ? "#27ae60" : pct >= 40 ? "#f39c12" : "#e74c3c";

		const buildBar = (pct: number) => {
			const color = scoreColor(pct);
			return `<div style="height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;margin:4px 0 6px 0"><div style="height:100%;width:${Math.min(100, Math.max(0, pct))}%;background:${color};border-radius:3px"></div></div>`;
		};

		const overallPct = assessment.overallScore;
		const overallColor = scoreColor(overallPct);

		const breakdownHtml = assessment.signalBreakdown.map(s => {
			const pct = s.maxScore > 0 ? Math.round((s.score / s.maxScore) * 100) : 0;
			return `<div style="margin-bottom:14px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><span style="font-weight:500;font-size:0.9em">${this.formatCategoryName(s.category)}</span><span style="font-size:0.85em;color:#888">${Math.round(s.score)}/${Math.round(s.maxScore)}</span></div>
${buildBar(pct)}
<div style="font-size:0.82em;color:#888;line-height:1.3">${s.reasoning}</div>
</div>`;
		}).join("\n");

		const driftHtml = assessment.driftIndicators.length > 0
			? assessment.driftIndicators.map(d => `<div style="border-left:2px solid #e74c3c;padding:6px 10px;margin-bottom:4px;font-size:0.9em;background:rgba(231,76,60,0.06);border-radius:0 4px 4px 0">${d}</div>`).join("\n")
			: `<div style="font-size:0.9em;color:#888">None</div>`;

		const momentumHtml = assessment.momentumIndicators.length > 0
			? assessment.momentumIndicators.map(m => `<div style="border-left:2px solid #27ae60;padding:6px 10px;margin-bottom:4px;font-size:0.9em;background:rgba(39,174,96,0.06);border-radius:0 4px 4px 0">${m}</div>`).join("\n")
			: `<div style="font-size:0.9em;color:#888">None</div>`;

		const content = `**Goal:** ${goal.text}
**Day ${assessment.dayNumber} of ${goal.timeWindowDays}** | Phase: ${goal.currentPhase}

<div style="text-align:center;padding:12px 0 4px 0">
<span style="font-size:2.5em;font-weight:700;color:${overallColor}">${assessment.overallScore}</span><span style="font-size:1em;color:#888">/100</span>
<div style="font-size:0.8em;color:#888;margin-top:4px">Day ${assessment.dayNumber} — ${assessment.date}</div>
</div>

### Signal Breakdown

${breakdownHtml}

---

### Drift Indicators

${driftHtml}

### Momentum Indicators

${momentumHtml}
`;

		const existing = this.app.vault.getAbstractFileByPath(filePath);
		if (existing) {
			await this.app.vault.modify(existing as import("obsidian").TFile, content);
		} else {
			await this.app.vault.create(filePath, content);
		}
	}

	// ── Check-in note link (inline in chat) ──

	private renderCheckInLink(parent: HTMLElement, assessment: Assessment, goal: NorthStarGoal): void {
		const goalSuffix = this.manager.getGoals().length > 1
			? ` (${goal.id.slice(-6)})`
			: "";
		const notePath = `NorthStar/check-ins/North Star Check-in — ${assessment.date}${goalSuffix}.md`;
		const link = parent.createDiv({ cls: "acta-northstar-checkin-link" });

		const scoreClass = assessment.overallScore >= 70
			? "acta-northstar-score-good"
			: assessment.overallScore >= 40
				? "acta-northstar-score-mid"
				: "acta-northstar-score-low";

		link.createEl("span", { cls: `acta-northstar-checkin-score ${scoreClass}`, text: `${assessment.overallScore}/100` });

		const goalLabel = this.manager.getGoals().length > 1
			? ` — ${goal.text.slice(0, 30)}${goal.text.length > 30 ? "..." : ""}`
			: "";
		link.createEl("span", { cls: "acta-northstar-checkin-label", text: ` — Day ${assessment.dayNumber} Check-in${goalLabel}` });
		link.createEl("span", { cls: "acta-northstar-checkin-open", text: "Open note \u2197" });

		link.addEventListener("click", () => {
			this.app.workspace.openLinkText(notePath, "", false);
		});
	}

	// ── Tinker Chat ──

	private renderTinkerChat(): void {
		if (!this.boardEl || !this.activeGoalId) return;

		const container = this.boardEl.createDiv({ cls: "acta-northstar-tinker-container" });
		container.createEl("h5", { text: "Tinker" });

		const messagesEl = container.createDiv({ cls: "acta-northstar-tinker-messages" });
		this.chatMessagesEl = messagesEl;

		// Render existing messages for the active goal only
		const messages = this.manager.getTinkerMessages(this.activeGoalId);
		for (const msg of messages) {
			if (msg.assessmentId) {
				const assessments = this.manager.getAssessments(this.activeGoalId);
				const assessment = assessments.find(a => a.id === msg.assessmentId);
				if (assessment) {
					const goalCtx = this.manager.getGoalContext(this.activeGoalId);
					if (goalCtx) {
						this.renderCheckInLink(messagesEl, assessment, goalCtx.goal);
					}
				}
			}
			this.appendMessageBubble(messagesEl, msg);
		}

		// Input container (Claudian-style bordered box)
		const inputContainer = container.createDiv({ cls: "acta-northstar-input-container" });
		const inputBox = inputContainer.createDiv({ cls: "acta-northstar-input-box" });

		const textarea = inputBox.createEl("textarea", {
			cls: "acta-northstar-input",
			attr: { placeholder: "Ask Tinker about your goal... (@ to mention files)", rows: "3" },
		});

		// File chips container (between textarea and toolbar)
		this.fileChipsEl = inputBox.createDiv({ cls: "acta-northstar-file-chips" });
		this.referencedFiles = [];
		this.updateFileChips();

		// Mention dropdown (absolutely positioned above input box)
		this.mentionDropdownEl = inputContainer.createDiv({ cls: "acta-northstar-mention-dropdown" });
		this.mentionDropdownEl.style.display = "none";

		// Toolbar inside the input box
		const toolbar = inputBox.createDiv({ cls: "acta-northstar-input-toolbar" });

		// Model selector (hover-based dropdown like Claudian)
		const models: { value: string; label: string }[] = [
			{ value: "claude-haiku-4-5-20251001", label: "Haiku" },
			{ value: "claude-sonnet-4-20250514", label: "Sonnet" },
			{ value: "claude-opus-4-6", label: "Opus" },
		];
		const currentModel = models.find(m => m.value === this.settings.northStarModel);

		const modelSelector = toolbar.createDiv({ cls: "acta-northstar-model-selector" });
		const modelBtn = modelSelector.createDiv({ cls: "acta-northstar-model-btn" });
		const modelLabel = modelBtn.createEl("span", { text: currentModel?.label || "Sonnet" });
		modelBtn.createEl("span", { cls: "acta-northstar-model-chevron", text: "\u25B4" });

		const dropdown = modelSelector.createDiv({ cls: "acta-northstar-model-dropdown" });
		for (const m of models) {
			const option = dropdown.createDiv({
				cls: `acta-northstar-model-option ${m.value === this.settings.northStarModel ? "is-selected" : ""}`,
				text: m.label,
			});
			option.addEventListener("click", () => {
				this.settings.northStarModel = m.value;
				modelLabel.textContent = m.label;
				dropdown.querySelectorAll(".acta-northstar-model-option").forEach(el => el.removeClass("is-selected"));
				option.addClass("is-selected");
			});
		}

		// Send button in toolbar (right side)
		const sendBtn = toolbar.createEl("button", {
			cls: "acta-northstar-send-btn",
			attr: { "aria-label": "Send" },
		});
		sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

		const doSend = () => {
			const text = textarea.value.trim();
			if (!text || this.isSending) return;
			textarea.value = "";
			const filesToSend = [...this.referencedFiles];
			this.referencedFiles = [];
			this.updateFileChips();
			this.sendTinkerMessage(text, messagesEl, textarea, sendBtn, filesToSend);
		};

		sendBtn.addEventListener("click", doSend);

		// Input event for @ mention detection
		textarea.addEventListener("input", () => {
			this.handleMentionInput(textarea);
		});

		textarea.addEventListener("keydown", (e: KeyboardEvent) => {
			// When mention dropdown is open, intercept navigation keys
			if (this.mentionDropdownEl && this.mentionDropdownEl.style.display !== "none") {
				if (e.key === "ArrowDown") {
					e.preventDefault();
					this.navigateMention(1);
					return;
				}
				if (e.key === "ArrowUp") {
					e.preventDefault();
					this.navigateMention(-1);
					return;
				}
				if (e.key === "Enter") {
					e.preventDefault();
					this.selectMentionItem(textarea);
					return;
				}
				if (e.key === "Escape") {
					e.preventDefault();
					this.closeMentionDropdown();
					return;
				}
			}

			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				doSend();
			}
		});

		// Scroll to bottom on initial render
		requestAnimationFrame(() => {
			messagesEl.scrollTop = messagesEl.scrollHeight;
		});
	}

	private appendMessageBubble(container: HTMLDivElement, msg: TinkerMessage): HTMLDivElement {
		const bubble = container.createDiv({
			cls: `acta-northstar-tinker-bubble acta-northstar-tinker-bubble-${msg.role}`,
		});

		// Show referenced file chips on user messages
		if (msg.role === "user" && msg.referencedFiles && msg.referencedFiles.length > 0) {
			const refsEl = bubble.createDiv({ cls: "acta-northstar-bubble-refs" });
			for (const ref of msg.referencedFiles) {
				refsEl.createSpan({ cls: "acta-northstar-bubble-ref-chip", text: `@${ref.basename}` });
			}
		}

		const contentEl = bubble.createDiv({ cls: "acta-northstar-tinker-bubble-content" });
		MarkdownRenderer.renderMarkdown(msg.content, contentEl, "", this);
		return bubble;
	}

	// ── Tool step indicators ──

	private renderToolStep(container: HTMLDivElement, label: string): HTMLDivElement {
		const step = container.createDiv({ cls: "acta-northstar-tool-step" });
		const indicator = step.createSpan({ cls: "acta-northstar-step-indicator" });
		indicator.textContent = "\u25CF"; // ●
		step.createSpan({ cls: "acta-northstar-step-label", text: label });
		step.addClass("acta-northstar-step-running");
		container.scrollTop = container.scrollHeight;
		return step;
	}

	private renderToolSubstep(parent: HTMLDivElement, text: string, status: "running" | "done"): HTMLDivElement {
		const sub = parent.createDiv({ cls: "acta-northstar-tool-substep" });
		const indicator = sub.createSpan({ cls: "acta-northstar-step-indicator" });
		indicator.textContent = status === "done" ? "\u2713" : "\u25CF"; // ✓ or ●
		sub.createSpan({ cls: "acta-northstar-step-label", text });
		sub.addClass(status === "done" ? "acta-northstar-step-done" : "acta-northstar-step-running");
		return sub;
	}

	private completeToolStep(stepEl: HTMLDivElement, detail: string): void {
		stepEl.removeClass("acta-northstar-step-running");
		stepEl.addClass("acta-northstar-step-done");
		const indicator = stepEl.querySelector(".acta-northstar-step-indicator");
		if (indicator) indicator.textContent = "\u2713"; // ✓
		if (detail) {
			stepEl.createSpan({ cls: "acta-northstar-step-detail", text: ` — ${detail}` });
		}
	}

	// ── Typing indicator helpers ──

	private addTypingIndicator(messagesEl: HTMLDivElement): HTMLDivElement {
		const typingEl = messagesEl.createDiv({ cls: "acta-northstar-tinker-typing" });
		typingEl.createSpan({ cls: "acta-northstar-tinker-dot" });
		typingEl.createSpan({ cls: "acta-northstar-tinker-dot" });
		typingEl.createSpan({ cls: "acta-northstar-tinker-dot" });
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return typingEl;
	}

	// ── Tool execution ──

	private async executeTool(
		toolName: string,
		toolInput: Record<string, unknown>,
		messagesEl: HTMLDivElement
	): Promise<{ result: string; assessments?: Assessment[] }> {
		switch (toolName) {
			case "get_today_date": {
				const today = this.getLocalDateStr();
				const yesterday = this.getYesterdayDateStr();
				const currentHour = new Date().getHours();
				const requestedDate = (toolInput.date as string) || today;
				const isYesterday = requestedDate === yesterday;

				if (!this.activeGoalId) {
					return { result: `Today is ${today}. No active goal selected.` };
				}

				const goalCtx = this.manager.getGoalContext(this.activeGoalId);
				if (!goalCtx) {
					return { result: `Today is ${today}. No active goal found.` };
				}

				const goal = goalCtx.goal;
				const dayNumber = this.manager.getDayNumber(goal.id);
				const adjustedDayNumber = isYesterday ? Math.max(1, dayNumber - 1) : dayNumber;
				const existing = this.manager.getAssessments(goal.id).find(a => a.date === requestedDate);
				const hasCheckin = !!existing;

				let dateResult = `Today is ${today}. Requested date: ${requestedDate}.`;
				dateResult += `\nGoal "${goal.text.slice(0, 50)}": Day ${adjustedDayNumber}.`;
				if (hasCheckin) {
					dateResult += ` Check-in exists (score: ${existing!.overallScore}/100). Running again will update it.`;
				} else {
					dateResult += ` No check-in yet.`;
				}

				if (isYesterday) {
					dateResult += `\nNOTE: This is yesterday's date. The user is doing a retroactive check-in. This is allowed — better late than never. Give a brief, gentle reminder to try to be more punctual next time, but proceed with the check-in.`;
				} else if (!toolInput.date && currentHour >= 0 && currentHour < 5) {
					dateResult += `\nLATE-NIGHT NOTE: It's past midnight (${currentHour}:00). The user might want to check in for yesterday (${yesterday}) instead of today. If the user's message suggests they're reflecting on today's (now yesterday's) work, ask if they'd like to check in for ${yesterday}. Otherwise proceed with today.`;
				}

				return { result: dateResult };
			}

			case "observe_signals": {
				const dateStr = (toolInput.date as string) || this.getLocalDateStr();
				const stepEl = this.renderToolStep(messagesEl, `Observing vault signals for ${dateStr}...`);

				const signals = await this.agent.observeSignals(dateStr, (stepId, status, detail) => {
					if (status === "done") {
						this.renderToolSubstep(stepEl, `${stepId} — ${detail}`, "done");
						messagesEl.scrollTop = messagesEl.scrollHeight;
					}
				});

				this.lastObservedSignals = signals;
				const priorityTasks = signals.tasks.filter(t => t.priority);
				const priorityCompleted = priorityTasks.filter(t => t.completed).length;
				const priorityDeepWork = priorityTasks.filter(t => t.effort === "deep_work").length;
				const summary = `Observed for ${dateStr}: ${priorityTasks.length} priority actions (${priorityCompleted} completed, ${priorityDeepWork} deep work), ${signals.feedback.length} feedback, ${signals.reflections.length} reflections, ${signals.vaultActivity.filesModified} files modified`;
				this.completeToolStep(stepEl, summary);
				messagesEl.scrollTop = messagesEl.scrollHeight;
				return { result: summary };
			}

			case "run_assessment": {
				if (!this.lastObservedSignals) {
					return { result: "Error: No observed signals available. Call observe_signals first." };
				}

				const dateStr = (toolInput.date as string) || this.getLocalDateStr();

				if (!this.activeGoalId) {
					return { result: "Error: No active goal selected." };
				}

				const goalCtx = this.manager.getGoalContext(this.activeGoalId);
				if (!goalCtx) {
					return { result: "Error: Active goal not found." };
				}

				const goal = goalCtx.goal;
				const stepEl = this.renderToolStep(messagesEl, `Running assessment for "${goal.text.slice(0, 40)}${goal.text.length > 40 ? "..." : ""}"...`);
				const assessment = await this.agent.assessSignals(goal.id, dateStr, this.lastObservedSignals);
				this.completeToolStep(stepEl, `Score: ${assessment.overallScore}/100`);

				// Create/update check-in note and render link in chat
				await this.createCheckInNote(assessment, goal);
				this.renderCheckInLink(messagesEl, assessment, goal);
				messagesEl.scrollTop = messagesEl.scrollHeight;

				const result =
					`Goal "${goal.text.slice(0, 50)}": ${assessment.overallScore}/100 (Day ${assessment.dayNumber}). ` +
					`Drift: ${assessment.driftIndicators.join("; ") || "None"}. ` +
					`Momentum: ${assessment.momentumIndicators.join("; ") || "None"}.`;

				return { result, assessments: [assessment] };
			}

			case "save_conversation_summary": {
				const dateStr = (toolInput.date as string) || this.getLocalDateStr();
				const summary = toolInput.summary as string;
				const overwrite = toolInput.overwrite as boolean;
				if (!summary) {
					return { result: "Error: No summary content provided." };
				}

				const folderPath = "NorthStar/check-ins";
				const activeGoalCtx = this.activeGoalId ? this.manager.getGoalContext(this.activeGoalId) : null;
				const goalSuffix = activeGoalCtx && this.manager.getGoals().length > 1
					? ` (${activeGoalCtx.goal.id.slice(-6)})`
					: "";
				const filePath = `${folderPath}/North Star Check-in — ${dateStr}${goalSuffix}.md`;
				const existingFile = this.app.vault.getAbstractFileByPath(filePath);

				// If existing Conversation Notes found and not a rewrite call, return old content for merging
				if (existingFile && !overwrite) {
					const currentContent = await this.app.vault.read(existingFile as import("obsidian").TFile);
					const marker = "## Conversation Notes";
					const markerIdx = currentContent.indexOf(marker);
					if (markerIdx >= 0) {
						const existingSummary = currentContent.substring(markerIdx + marker.length).trim();
						return {
							result: `EXISTING CONVERSATION NOTES FOUND for ${dateStr}:\n\n${existingSummary}\n\nYou must merge the old notes with the new conversation insights into a single unified summary. Call save_conversation_summary again with overwrite: true and a rewritten summary that incorporates BOTH the previous notes and the current conversation.`,
						};
					}
				}

				// Save the summary
				const stepEl = this.renderToolStep(messagesEl, "Saving conversation notes...");
				const summaryBlock = `\n\n---\n\n## Conversation Notes\n\n${summary}\n`;

				if (existingFile) {
					const currentContent = await this.app.vault.read(existingFile as import("obsidian").TFile);
					const marker = "## Conversation Notes";
					const markerIdx = currentContent.indexOf(marker);
					if (markerIdx >= 0) {
						const beforeMarker = currentContent.lastIndexOf("---", markerIdx);
						const trimPoint = beforeMarker >= 0 ? beforeMarker : markerIdx;
						const updated = currentContent.substring(0, trimPoint).trimEnd() + summaryBlock;
						await this.app.vault.modify(existingFile as import("obsidian").TFile, updated);
					} else {
						await this.app.vault.modify(existingFile as import("obsidian").TFile, currentContent.trimEnd() + summaryBlock);
					}
					this.completeToolStep(stepEl, "Updated check-in note with conversation notes");
				} else {
					if (!this.app.vault.getAbstractFileByPath(folderPath)) {
						await this.app.vault.createFolder(folderPath);
					}
					const goalText = activeGoalCtx ? activeGoalCtx.goal.text : "No goal set";
					const content = `**Goal:** ${goalText}\n${summaryBlock}`;
					await this.app.vault.create(filePath, content);
					this.completeToolStep(stepEl, "Created check-in note with conversation notes");
				}

				// Render check-in link for the active goal
				if (activeGoalCtx) {
					const latestAssessment = this.manager.getAssessments(activeGoalCtx.goal.id).find(a => a.date === dateStr);
					if (latestAssessment) {
						this.renderCheckInLink(messagesEl, latestAssessment, activeGoalCtx.goal);
					}
				}

				messagesEl.scrollTop = messagesEl.scrollHeight;
				return { result: `Conversation summary saved to check-in note for ${dateStr}.` };
			}

			case "get_assessment_history": {
				const count = (toolInput.count as number) || 5;

				if (!this.activeGoalId) {
					return { result: "No active goal selected." };
				}

				const goalCtx = this.manager.getGoalContext(this.activeGoalId);
				if (!goalCtx) {
					return { result: "Active goal not found." };
				}

				const assessments = this.manager.getAssessments(this.activeGoalId);
				const recent = assessments.slice(-count);

				if (recent.length === 0) {
					return { result: `Goal "${goalCtx.goal.text.slice(0, 50)}": No assessment history.` };
				}

				const lines = recent.map(a =>
					`  Day ${a.dayNumber} (${a.date}): ${a.overallScore}/100`
				);
				return { result: `Goal "${goalCtx.goal.text.slice(0, 50)}" (last ${recent.length}):\n${lines.join("\n")}` };
			}

			default:
				return { result: `Unknown tool: ${toolName}` };
		}
	}

	// ── Agentic loop ──

	private async sendTinkerMessage(
		text: string,
		messagesEl: HTMLDivElement,
		textarea: HTMLTextAreaElement,
		sendBtn: HTMLButtonElement,
		referencedFiles: TFile[] = []
	): Promise<void> {
		if (!this.activeGoalId) return;
		const goalId = this.activeGoalId;

		this.isSending = true;
		textarea.disabled = true;
		sendBtn.disabled = true;
		sendBtn.addClass("is-disabled");

		// Save and render user message
		const refMeta = referencedFiles.length > 0
			? referencedFiles.map(f => ({ path: f.path, basename: f.basename }))
			: undefined;
		const userMsg: TinkerMessage = { role: "user", content: text, timestamp: Date.now(), referencedFiles: refMeta };
		await this.manager.addTinkerMessage(goalId, userMsg);
		this.appendMessageBubble(messagesEl, userMsg);

		let typingEl = this.addTypingIndicator(messagesEl);

		let producedAssessments: Assessment[] = [];

		try {
			const systemPrompt = this.buildTinkerSystemPrompt();

			// Build API messages from the active goal's persisted messages
			const MAX_FILE_SIZE = 50 * 1024; // 50KB
			const persistedMessages = this.manager.getTinkerMessages(goalId);
			const apiMessages: ApiMessage[] = [];
			for (const m of persistedMessages) {
				let content = m.content;
				// For user messages with referenced files, prepend file contents
				if (m.role === "user" && m.referencedFiles && m.referencedFiles.length > 0) {
					const fileBlocks: string[] = [];
					for (const ref of m.referencedFiles) {
						const file = this.app.vault.getAbstractFileByPath(ref.path);
						if (file && file instanceof TFile) {
							try {
								let fileContent = await this.app.vault.cachedRead(file);
								if (fileContent.length > MAX_FILE_SIZE) {
									fileContent = fileContent.substring(0, MAX_FILE_SIZE) + "\n... (truncated)";
								}
								fileBlocks.push(`<referenced_file path="${ref.path}">\n${fileContent}\n</referenced_file>`);
							} catch {
								fileBlocks.push(`<referenced_file path="${ref.path}">\n[Error reading file]\n</referenced_file>`);
							}
						}
					}
					if (fileBlocks.length > 0) {
						content = fileBlocks.join("\n\n") + "\n\n" + content;
					}
				}
				apiMessages.push({ role: m.role, content });
			}

			// Agentic loop
			let maxIterations = 10;
			while (maxIterations-- > 0) {
				const response = await this.llmClient.chatWithTools(systemPrompt, apiMessages, TOOL_DEFINITIONS);

				// Append assistant response to API messages
				apiMessages.push({ role: "assistant", content: response.content });

				if (response.stop_reason === "end_turn") {
					// Extract text blocks for the final response
					const textParts = response.content
						.filter((b): b is TextBlock => b.type === "text")
						.map(b => b.text);
					const finalText = textParts.join("\n").trim();

					typingEl.remove();

					if (finalText) {
						const assistantMsg: TinkerMessage = {
							role: "assistant",
							content: finalText,
							timestamp: Date.now(),
							assessmentId: producedAssessments.length > 0 ? producedAssessments[0].id : undefined,
						};
						await this.manager.addTinkerMessage(goalId, assistantMsg);
						this.appendMessageBubble(messagesEl, assistantMsg);
					}
					break;
				}

				if (response.stop_reason === "tool_use") {
					// Remove typing indicator during tool execution
					typingEl.remove();

					const toolUseBlocks = response.content.filter(
						(b): b is ToolUseBlock => b.type === "tool_use"
					);

					const toolResults: ContentBlock[] = [];

					for (const toolBlock of toolUseBlocks) {
						try {
							const { result, assessments } = await this.executeTool(
								toolBlock.name,
								toolBlock.input,
								messagesEl
							);

							if (assessments) {
								producedAssessments = assessments;
							}

							toolResults.push({
								type: "tool_result",
								tool_use_id: toolBlock.id,
								content: result,
							});
						} catch (e) {
							const errorMsg = e instanceof Error ? e.message : "Unknown error";
							toolResults.push({
								type: "tool_result",
								tool_use_id: toolBlock.id,
								content: `Error: ${errorMsg}`,
								is_error: true,
							});
						}
					}

					// Append tool results as user message
					apiMessages.push({ role: "user", content: toolResults });

					// Restore typing indicator
					typingEl = this.addTypingIndicator(messagesEl);
					continue;
				}

				// Unknown stop_reason — treat as end
				typingEl.remove();
				break;
			}

		} catch (e) {
			typingEl.remove();
			const errorMsg = e instanceof Error ? e.message : "Unknown error";
			const errorEl = messagesEl.createDiv({ cls: "acta-northstar-tinker-error" });
			errorEl.textContent = `Error: ${errorMsg}`;
		}

		messagesEl.scrollTop = messagesEl.scrollHeight;
		this.isSending = false;
		textarea.disabled = false;
		sendBtn.disabled = false;
		sendBtn.removeClass("is-disabled");
		textarea.focus();
	}

	// ── @ Mention handling ──

	private handleMentionInput(textarea: HTMLTextAreaElement): void {
		const cursorPos = textarea.selectionStart;
		const text = textarea.value.substring(0, cursorPos);

		// Scan backward from cursor for @
		let atIndex = -1;
		for (let i = text.length - 1; i >= 0; i--) {
			if (text[i] === "@") {
				// Make sure it's at start or preceded by whitespace
				if (i === 0 || /\s/.test(text[i - 1])) {
					atIndex = i;
				}
				break;
			}
			// Stop if we hit whitespace before finding @
			if (text[i] === "\n") break;
		}

		if (atIndex === -1) {
			this.closeMentionDropdown();
			return;
		}

		this.mentionStartIndex = atIndex;
		this.mentionQuery = text.substring(atIndex + 1);
		this.showMentionDropdown(textarea);
	}

	private showMentionDropdown(textarea: HTMLTextAreaElement): void {
		if (!this.mentionDropdownEl) return;

		const query = this.mentionQuery.toLowerCase();
		const allFiles = this.app.vault.getMarkdownFiles();
		const referencedPaths = new Set(this.referencedFiles.map(f => f.path));

		this.mentionFilteredFiles = allFiles
			.filter(f => !referencedPaths.has(f.path))
			.filter(f => {
				if (!query) return true;
				return f.basename.toLowerCase().includes(query) || f.path.toLowerCase().includes(query);
			})
			.slice(0, 10);

		if (this.mentionFilteredFiles.length === 0) {
			this.closeMentionDropdown();
			return;
		}

		this.mentionSelectedIndex = 0;
		this.mentionDropdownEl.empty();
		this.mentionDropdownEl.style.display = "block";

		for (let i = 0; i < this.mentionFilteredFiles.length; i++) {
			const file = this.mentionFilteredFiles[i];
			const item = this.mentionDropdownEl.createDiv({
				cls: `acta-northstar-mention-item${i === 0 ? " is-selected" : ""}`,
			});
			item.createSpan({ cls: "acta-northstar-mention-name", text: file.basename });
			const folder = file.path.substring(0, file.path.length - file.name.length - 1);
			if (folder) {
				item.createSpan({ cls: "acta-northstar-mention-path", text: folder });
			}
			item.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.mentionSelectedIndex = i;
				this.selectMentionItem(textarea);
			});
		}
	}

	private navigateMention(direction: number): void {
		if (this.mentionFilteredFiles.length === 0) return;
		this.mentionSelectedIndex = (this.mentionSelectedIndex + direction + this.mentionFilteredFiles.length) % this.mentionFilteredFiles.length;
		this.updateMentionSelection();
	}

	private updateMentionSelection(): void {
		if (!this.mentionDropdownEl) return;
		const items = this.mentionDropdownEl.querySelectorAll(".acta-northstar-mention-item");
		items.forEach((el, i) => {
			if (i === this.mentionSelectedIndex) {
				el.addClass("is-selected");
				(el as HTMLElement).scrollIntoView({ block: "nearest" });
			} else {
				el.removeClass("is-selected");
			}
		});
	}

	private selectMentionItem(textarea: HTMLTextAreaElement): void {
		const file = this.mentionFilteredFiles[this.mentionSelectedIndex];
		if (!file) return;

		this.referencedFiles.push(file);
		this.updateFileChips();

		// Remove @query text from textarea
		const before = textarea.value.substring(0, this.mentionStartIndex);
		const after = textarea.value.substring(textarea.selectionStart);
		textarea.value = before + after;
		textarea.selectionStart = textarea.selectionEnd = before.length;

		this.closeMentionDropdown();
		textarea.focus();
	}

	private closeMentionDropdown(): void {
		if (this.mentionDropdownEl) {
			this.mentionDropdownEl.style.display = "none";
			this.mentionDropdownEl.empty();
		}
		this.mentionQuery = "";
		this.mentionStartIndex = -1;
		this.mentionSelectedIndex = 0;
		this.mentionFilteredFiles = [];
	}

	private updateFileChips(): void {
		if (!this.fileChipsEl) return;
		this.fileChipsEl.empty();

		if (this.referencedFiles.length === 0) {
			this.fileChipsEl.style.display = "none";
			return;
		}

		this.fileChipsEl.style.display = "flex";
		for (let i = 0; i < this.referencedFiles.length; i++) {
			const file = this.referencedFiles[i];
			const chip = this.fileChipsEl.createDiv({ cls: "acta-northstar-file-chip" });
			chip.createSpan({ text: file.basename });
			const removeBtn = chip.createSpan({ cls: "acta-northstar-file-chip-remove", text: "\u00d7" });
			removeBtn.addEventListener("click", () => {
				this.referencedFiles.splice(i, 1);
				this.updateFileChips();
			});
		}
	}

	private buildTinkerSystemPrompt(): string {
		if (!this.activeGoalId) return "No active goals.";

		const goalCtx = this.manager.getGoalContext(this.activeGoalId);
		if (!goalCtx) return "No active goals.";

		const goal = goalCtx.goal;
		const dayNumber = this.manager.getDayNumber(goal.id);
		const daysLeft = this.manager.getDaysLeft(goal.id);
		const latest = this.manager.getLatestAssessment(goal.id);

		let assessmentBlock = "No assessment yet.";
		if (latest) {
			const breakdownLines = latest.signalBreakdown.map(
				s => `- ${this.formatCategoryName(s.category)}: ${Math.round(s.score)}/${Math.round(s.maxScore)} — ${s.reasoning}`
			).join("\n");
			const driftLines = latest.driftIndicators.length > 0
				? latest.driftIndicators.map(d => `- ${d}`).join("\n")
				: "- None";
			const momentumLines = latest.momentumIndicators.length > 0
				? latest.momentumIndicators.map(m => `- ${m}`).join("\n")
				: "- None";

			assessmentBlock = `Score: ${latest.overallScore}/100 (Day ${latest.dayNumber}, ${latest.date})
Signal Breakdown:
${breakdownLines}
Drift:
${driftLines}
Momentum:
${momentumLines}`;
		}

		const contextBlock = goal.context
			? `\nReference Context:\n${goal.context}\n`
			: "";

		const goalBlock = `### Goal: "${goal.text}"
Day ${dayNumber} of ${goal.timeWindowDays} | Phase: ${goal.currentPhase} | ${daysLeft}d left
${contextBlock}
Latest Assessment:
${assessmentBlock}`;

		return `You are Tinker, a goal-alignment coach embedded in North Star. This conversation is scoped to a single goal.

## Your Role
- Challenge assumptions, surface patterns, pressure-test decisions
- Be direct and specific — reference actual tasks, scores, and signals
- Push back when the user rationalizes drift
- You are NOT a general-purpose assistant. Stay focused on the goal.

## Tools Available
When the user asks for a "check-in", "how am I doing", "run a cycle", or similar:
1. First call get_today_date to get today's date and check if a check-in exists. If the user asks for a specific date (e.g. "check in for yesterday"), pass that date to get_today_date.
2. Then call observe_signals with that date to collect data
3. Then call run_assessment with that date to score alignment
4. Then provide your commentary and coaching

IMPORTANT: Always call get_today_date first and pass its date to the other tools. This ensures consistent dates and proper updates. If a check-in already exists for that date, tell the user you're updating it.

## Late & Retroactive Check-ins
- If the user asks to check in for yesterday, or it's past midnight and they're reflecting on the day that just ended: ALLOW IT. Better late than never.
- When doing a retroactive check-in, give a brief, warm reminder like: "Let's do the check-in for yesterday — but let's try to be more punctual next time so we capture things while they're fresh."
- Do NOT refuse or lecture. Just gently note it and proceed.
- If it's past midnight (the get_today_date tool will tell you), proactively ask whether they want to check in for yesterday or today.

Use get_assessment_history when the user asks about trends or progress over time.

When the user asks to "summarize", "save notes", "capture takeaways", or similar:
1. Call get_today_date first if you haven't already
2. Call save_conversation_summary with a markdown summary of the conversation — include key insights, action items, and decisions
3. The summary will be appended to that day's check-in note

IMPORTANT for save_conversation_summary:
- Write the summary in the SAME language(s) the conversation used. If the user spoke in Chinese, summarize in Chinese. If mixed (e.g. Chinese + English), keep that mix. Preserve the original voice and expressions — do not translate.
- Do NOT include a title/heading in the summary — the "## Conversation Notes" heading is added automatically. Start directly with the content (e.g. bullet points, sections with ### subheadings).

Do NOT call tools unless the conversation warrants it. For regular coaching questions, just respond with text.

## Current Goal
${goalBlock}

## Priority Actions (IMPORTANT)
The system extracts tasks from the "Today's Priority Actions" section in the daily note. The assessment ONLY evaluates these priority tasks — not the full task board. When coaching and commenting on check-in results, focus exclusively on the priority actions. Do NOT mention the total task count or non-priority tasks. Only discuss how well the user executed on their chosen priority actions for the day.

Deep work includes any sustained focused work: coding, reading papers, research, studying, designing, writing — not just "development". If a priority task has a time annotation (like @10PM-1AM), that's a deep work session.

## What Tinker never does
- No file/vault operations
- No general Q&A unrelated to the goal
- No flattery or empty encouragement`;
	}
}
