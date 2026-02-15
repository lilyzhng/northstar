import { ItemView, WorkspaceLeaf, TFile, debounce } from "obsidian";
import {
	ActaTaskSettings,
	FeedbackGroup,
	FeedbackItem,
	ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE,
} from "./types";
import { NegativeFeedbackScanner } from "./negativeFeedbackScanner";
import { NegativeFeedbackManager } from "./negativeFeedbackManager";

export class NegativeFeedbackBoardView extends ItemView {
	private scanner: NegativeFeedbackScanner;
	private negativeFeedbackManager: NegativeFeedbackManager;
	private settings: ActaTaskSettings;
	private collapsedTopics: Set<string> = new Set();
	private boardEl: HTMLDivElement | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		scanner: NegativeFeedbackScanner,
		negativeFeedbackManager: NegativeFeedbackManager,
		settings: ActaTaskSettings
	) {
		super(leaf);
		this.scanner = scanner;
		this.negativeFeedbackManager = negativeFeedbackManager;
		this.settings = settings;
	}

	getViewType(): string {
		return ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE;
	}

	getDisplayText(): string {
		return "😒 负反馈board";
	}

	getIcon(): string {
		return "frown";
	}

	async onOpen(): Promise<void> {
		const container = this.containerEl.children[1];
		container.empty();
		container.addClass("northstar-container");

		this.boardEl = container.createDiv({ cls: "northstar-board acta-negative-feedback-board" });
		await this.refresh();

		this.registerEvents();
	}

	async onClose(): Promise<void> {}

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

	private renderBoard(topics: FeedbackGroup[]): void {
		if (!this.boardEl) return;

		this.boardEl.empty();

		// Header
		const header = this.boardEl.createDiv({ cls: "northstar-header" });
		const titleRow = header.createDiv({ cls: "northstar-title-row" });

		titleRow.createEl("h4", { text: "😒 负反馈board" });

		const refreshBtn = titleRow.createEl("button", {
			cls: "northstar-refresh-btn clickable-icon",
			attr: { "aria-label": "Refresh" },
		});
		refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
		refreshBtn.addEventListener("click", () => this.refresh());

		const totalItems = topics.reduce((sum, t) => sum + t.totalCount, 0);

		header.createDiv({
			cls: "northstar-stats",
			text: `${totalItems} items across ${topics.length} topics`,
		});

		// Empty state
		if (topics.length === 0) {
			this.boardEl.createDiv({
				cls: "northstar-empty",
				text: "No 负反馈 items yet. Add notes with #😒 and a topic tag (e.g. #work) to see them here.",
			});
			return;
		}

		// Topic sections
		const list = this.boardEl.createDiv({ cls: "northstar-topics" });
		for (const topic of topics) {
			this.renderTopicSection(list, topic);
		}
	}

	private renderTopicSection(
		parent: HTMLElement,
		topic: FeedbackGroup
	): void {
		const section = parent.createDiv({ cls: "northstar-topic-section" });
		const isCollapsed = this.collapsedTopics.has(topic.tag);

		const topicHeader = section.createDiv({
			cls: "northstar-topic-header",
		});

		const chevron = topicHeader.createSpan({
			cls: `northstar-chevron ${isCollapsed ? "is-collapsed" : ""}`,
		});
		chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;

		topicHeader.createSpan({
			cls: "northstar-topic-tag",
			text: `#${topic.displayTag}`,
		});

		topicHeader.createSpan({
			cls: "northstar-topic-count",
			text: `${topic.totalCount}`,
		});

		topicHeader.addEventListener("click", () => {
			if (this.collapsedTopics.has(topic.tag)) {
				this.collapsedTopics.delete(topic.tag);
			} else {
				this.collapsedTopics.add(topic.tag);
			}
			this.refresh();
		});

		// Render items if not collapsed
		if (!isCollapsed) {
			const itemList = section.createDiv({ cls: "northstar-list" });
			for (const item of topic.items) {
				this.renderFeedbackItem(itemList, item);
			}
		}
	}

	private renderFeedbackItem(
		parent: HTMLElement,
		item: FeedbackItem
	): void {
		const itemEl = parent.createDiv({
			cls: "northstar-item acta-feedback-item acta-negative-feedback-item",
		});

		// Feedback text
		itemEl.createSpan({
			cls: "northstar-text acta-feedback-text",
			text: item.text,
		});

		// Metadata
		if (this.settings.showSourceNote) {
			const metaContainer = itemEl.createSpan({
				cls: "northstar-meta",
			});

			// Source note badge (clickable)
			const badge = metaContainer.createSpan({
				cls: "northstar-source-badge",
				text: item.fileName,
			});

			badge.addEventListener("click", async (e) => {
				e.stopPropagation();
				const file = this.app.vault.getAbstractFileByPath(
					item.filePath
				);
				if (file instanceof TFile) {
					await this.app.workspace.getLeaf(false).openFile(file, {
						eState: { line: item.line },
					});
				}
			});

			// Date badge
			const date = new Date(item.addedAt);
			const dateStr = date.toLocaleDateString(undefined, {
				month: "short",
				day: "numeric",
			});
			metaContainer.createSpan({
				cls: "northstar-date-badge",
				text: dateStr,
			});
		}

		// Remove button
		const removeBtn = itemEl.createSpan({
			cls: "northstar-remove-btn",
			text: "×",
			attr: { title: "Remove from board" },
		});

		removeBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.negativeFeedbackManager.removeFeedback(item.id);
			this.refresh();
		});
	}
}
