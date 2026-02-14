import { ItemView, WorkspaceLeaf, Notice, MarkdownRenderer } from "obsidian";
import { ActaTaskSettings, ACTA_NORTHSTAR_VIEW_TYPE } from "./types";
import { NorthStarManager } from "./northStarManager";
import { NorthStarAgent } from "./northStarAgent";
import { NorthStarLlmClient } from "./northStarLlmClient";
import { NorthStarGoalModal } from "./northStarGoalModal";
import {
	Assessment,
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
		description: "Get today's local date, day number, and whether a check-in already exists for today. Always call this first before observe_signals or run_assessment.",
		input_schema: {
			type: "object",
			properties: {},
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
		description: "Run an LLM alignment assessment on collected signals. Call observe_signals first. Pass the same date.",
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
		description: "Retrieve past assessments for trend analysis.",
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
		container.addClass("acta-task-container");

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

	private renderBoard(): void {
		if (!this.boardEl) return;
		this.boardEl.empty();
		this.chatMessagesEl = null;

		const goal = this.manager.getGoal();

		this.renderHeader();

		if (!goal) {
			this.renderEmptyGoalState();
			return;
		}

		this.renderGoalCard();

		// Chat always shown when goal exists (assessment renders inline in chat only)
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

	// ── Check-in note creation ──

	private async createCheckInNote(assessment: Assessment): Promise<void> {
		const goal = this.manager.getGoal();
		if (!goal) return;

		const folderPath = "NorthStar/check-ins";
		const filePath = `${folderPath}/North Star Check-in — ${assessment.date}.md`;

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

	private renderCheckInLink(parent: HTMLElement, assessment: Assessment): void {
		const notePath = `NorthStar/check-ins/North Star Check-in — ${assessment.date}.md`;
		const link = parent.createDiv({ cls: "acta-northstar-checkin-link" });

		const scoreClass = assessment.overallScore >= 70
			? "acta-northstar-score-good"
			: assessment.overallScore >= 40
				? "acta-northstar-score-mid"
				: "acta-northstar-score-low";

		link.createEl("span", { cls: `acta-northstar-checkin-score ${scoreClass}`, text: `${assessment.overallScore}/100` });
		link.createEl("span", { cls: "acta-northstar-checkin-label", text: ` — Day ${assessment.dayNumber} Check-in` });
		link.createEl("span", { cls: "acta-northstar-checkin-open", text: "Open note \u2197" });

		link.addEventListener("click", () => {
			this.app.workspace.openLinkText(notePath, "", false);
		});
	}

	// ── Tinker Chat ──

	private renderTinkerChat(): void {
		if (!this.boardEl) return;

		const container = this.boardEl.createDiv({ cls: "acta-northstar-tinker-container" });
		container.createEl("h5", { text: "Tinker" });

		const messagesEl = container.createDiv({ cls: "acta-northstar-tinker-messages" });
		this.chatMessagesEl = messagesEl;

		// Render existing messages (with inline assessment re-rendering)
		const messages = this.manager.getTinkerMessages();
		for (const msg of messages) {
			if (msg.assessmentId) {
				const assessment = this.manager.getAssessments().find(a => a.id === msg.assessmentId);
				if (assessment) {
					this.renderCheckInLink(messagesEl, assessment);
				}
			}
			this.appendMessageBubble(messagesEl, msg);
		}

		// Input container (Claudian-style bordered box)
		const inputContainer = container.createDiv({ cls: "acta-northstar-input-container" });
		const inputBox = inputContainer.createDiv({ cls: "acta-northstar-input-box" });

		const textarea = inputBox.createEl("textarea", {
			cls: "acta-northstar-input",
			attr: { placeholder: "Ask Tinker about your goal...", rows: "3" },
		});

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
			this.sendTinkerMessage(text, messagesEl, textarea, sendBtn);
		};

		sendBtn.addEventListener("click", doSend);
		textarea.addEventListener("keydown", (e: KeyboardEvent) => {
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
	): Promise<{ result: string; assessment?: Assessment }> {
		switch (toolName) {
			case "get_today_date": {
				const today = this.getLocalDateStr();
				const dayNumber = this.manager.getDayNumber();
				const existing = this.manager.getAssessments().find(a => a.date === today);
				const hasCheckin = !!existing;
				return {
					result: `Today is ${today}. Day ${dayNumber}. ${hasCheckin ? `A check-in already exists for today (score: ${existing!.overallScore}/100). Running again will update it in place.` : "No check-in yet for today."}`,
				};
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
				const summary = `Observed for ${dateStr}: ${signals.tasks.length} tasks, ${signals.feedback.length} feedback, ${signals.reflections.length} reflections, ${signals.vaultActivity.filesModified} files modified`;
				this.completeToolStep(stepEl, summary);
				messagesEl.scrollTop = messagesEl.scrollHeight;
				return { result: summary };
			}

			case "run_assessment": {
				if (!this.lastObservedSignals) {
					return { result: "Error: No observed signals available. Call observe_signals first." };
				}

				const dateStr = (toolInput.date as string) || this.getLocalDateStr();
				const stepEl = this.renderToolStep(messagesEl, "Running alignment assessment...");
				const assessment = await this.agent.assessSignals(dateStr, this.lastObservedSignals);
				this.completeToolStep(stepEl, `Score: ${assessment.overallScore}/100`);

				// Create/update check-in note and render link in chat
				await this.createCheckInNote(assessment);
				this.renderCheckInLink(messagesEl, assessment);
				messagesEl.scrollTop = messagesEl.scrollHeight;

				const result = `Assessment complete. Score: ${assessment.overallScore}/100 (Day ${assessment.dayNumber}). ` +
					`Drift: ${assessment.driftIndicators.join("; ") || "None"}. ` +
					`Momentum: ${assessment.momentumIndicators.join("; ") || "None"}.`;

				return { result, assessment };
			}

			case "save_conversation_summary": {
				const dateStr = (toolInput.date as string) || this.getLocalDateStr();
				const summary = toolInput.summary as string;
				const overwrite = toolInput.overwrite as boolean;
				if (!summary) {
					return { result: "Error: No summary content provided." };
				}

				const folderPath = "NorthStar/check-ins";
				const filePath = `${folderPath}/North Star Check-in — ${dateStr}.md`;
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
					const goal = this.manager.getGoal();
					const goalText = goal ? goal.text : "No goal set";
					const content = `**Goal:** ${goalText}\n${summaryBlock}`;
					await this.app.vault.create(filePath, content);
					this.completeToolStep(stepEl, "Created check-in note with conversation notes");
				}

				// Render check-in link so user can open the note
				const latestAssessment = this.manager.getAssessments().find(a => a.date === dateStr);
				if (latestAssessment) {
					this.renderCheckInLink(messagesEl, latestAssessment);
				} else {
					const notePath = filePath;
					const link = messagesEl.createDiv({ cls: "acta-northstar-checkin-link" });
					link.createEl("span", { cls: "acta-northstar-checkin-label", text: `Check-in — ${dateStr}` });
					link.createEl("span", { cls: "acta-northstar-checkin-open", text: "Open note \u2197" });
					link.addEventListener("click", () => {
						this.app.workspace.openLinkText(notePath, "", false);
					});
				}

				messagesEl.scrollTop = messagesEl.scrollHeight;
				return { result: `Conversation summary saved to check-in note for ${dateStr}.` };
			}

			case "get_assessment_history": {
				const count = (toolInput.count as number) || 5;
				const assessments = this.manager.getAssessments();
				const recent = assessments.slice(-count);

				if (recent.length === 0) {
					return { result: "No assessment history available." };
				}

				const lines = recent.map(a =>
					`Day ${a.dayNumber} (${a.date}): ${a.overallScore}/100`
				);
				return { result: `Assessment history (last ${recent.length}):\n${lines.join("\n")}` };
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
		sendBtn: HTMLButtonElement
	): Promise<void> {
		this.isSending = true;
		textarea.disabled = true;
		sendBtn.disabled = true;
		sendBtn.addClass("is-disabled");

		// Save and render user message
		const userMsg: TinkerMessage = { role: "user", content: text, timestamp: Date.now() };
		await this.manager.addTinkerMessage(userMsg);
		this.appendMessageBubble(messagesEl, userMsg);

		let typingEl = this.addTypingIndicator(messagesEl);

		let producedAssessment: Assessment | null = null;

		try {
			const systemPrompt = this.buildTinkerSystemPrompt();

			// Build API messages from persisted text messages
			const apiMessages: ApiMessage[] = this.manager.getTinkerMessages().map(m => ({
				role: m.role,
				content: m.content,
			}));

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
							assessmentId: producedAssessment?.id,
						};
						await this.manager.addTinkerMessage(assistantMsg);
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
							const { result, assessment } = await this.executeTool(
								toolBlock.name,
								toolBlock.input,
								messagesEl
							);

							if (assessment) {
								producedAssessment = assessment;
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

	private buildTinkerSystemPrompt(): string {
		const goal = this.manager.getGoal();
		if (!goal) return "No active goal.";

		const dayNumber = this.manager.getDayNumber();
		const daysLeft = this.manager.getDaysLeft();
		const latest = this.manager.getLatestAssessment();

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

		return `You are Tinker, a goal-alignment coach embedded in North Star.

## Your Role
- Challenge assumptions, surface patterns, pressure-test decisions
- Be direct and specific — reference actual tasks, scores, and signals
- Push back when the user rationalizes drift
- You are NOT a general-purpose assistant. Stay focused on the goal.

## Tools Available
When the user asks for a "check-in", "how am I doing", "run a cycle", or similar:
1. First call get_today_date to get today's date and check if a check-in exists
2. Then call observe_signals with that date to collect data
3. Then call run_assessment with that date to score alignment (this updates any existing check-in in place)
4. Then provide your commentary and coaching

IMPORTANT: Always call get_today_date first and pass its date to the other tools. This ensures consistent dates and proper updates. If a check-in already exists for today, tell the user you're updating it.

Use get_assessment_history when the user asks about trends or progress over time.

When the user asks to "summarize", "save notes", "capture takeaways", or similar:
1. Call get_today_date first if you haven't already
2. Call save_conversation_summary with a markdown summary of the conversation — include key insights, action items, and decisions
3. The summary will be appended to that day's check-in note

IMPORTANT for save_conversation_summary:
- Write the summary in the SAME language(s) the conversation used. If the user spoke in Chinese, summarize in Chinese. If mixed (e.g. Chinese + English), keep that mix. Preserve the original voice and expressions — do not translate.
- Do NOT include a title/heading in the summary — the "## Conversation Notes" heading is added automatically. Start directly with the content (e.g. bullet points, sections with ### subheadings).

Do NOT call tools unless the conversation warrants it. For regular coaching questions, just respond with text.

## Current Context
Goal: "${goal.text}"
Day ${dayNumber} of ${goal.timeWindowDays} | Phase: ${goal.currentPhase} | ${daysLeft}d left

## Latest Assessment
${assessmentBlock}

## What Tinker never does
- No file/vault operations
- No general Q&A unrelated to the goal
- No flattery or empty encouragement`;
	}
}
