var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => ActaTaskPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian12 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  excludedTags: [],
  excludedFolders: [".obsidian"],
  showCompleted: true,
  showSourceNote: true,
  topicSortOrder: "alphabetical",
  taskSortOrder: "incompleteFirst",
  anthropicApiKey: "",
  northStarModel: "claude-sonnet-4-20250514"
};
var DEFAULT_DATA = {
  addedTasks: {}
};
var ACTA_TASK_VIEW_TYPE = "acta-task-board";
var DEFAULT_FEEDBACK_DATA = {
  addedFeedback: {}
};
var ACTA_FEEDBACK_VIEW_TYPE = "acta-feedback-board";
var FEEDBACK_TRIGGER_TAGS = ["#\u6B63\u53CD\u9988", "#\u2764\uFE0F"];
var DEFAULT_NEGATIVE_FEEDBACK_DATA = {
  addedNegativeFeedback: {}
};
var ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE = "acta-negative-feedback-board";
var NEGATIVE_FEEDBACK_TRIGGER_TAGS = ["#\u{1F612}"];
var ACTA_NORTHSTAR_VIEW_TYPE = "acta-northstar-board";

// src/taskBoardView.ts
var import_obsidian = require("obsidian");
var TaskBoardView = class extends import_obsidian.ItemView {
  constructor(leaf, scanner, toggler, taskManager, settings) {
    super(leaf);
    this.collapsedTopics = /* @__PURE__ */ new Set();
    this.boardEl = null;
    this.scanner = scanner;
    this.toggler = toggler;
    this.taskManager = taskManager;
    this.settings = settings;
  }
  getViewType() {
    return ACTA_TASK_VIEW_TYPE;
  }
  getDisplayText() {
    return "Acta Task Board";
  }
  getIcon() {
    return "list-checks";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("acta-task-container");
    this.boardEl = container.createDiv({ cls: "acta-task-board" });
    await this.refresh();
    this.registerEvents();
  }
  async onClose() {
  }
  updateSettings(settings) {
    this.settings = settings;
    this.scanner.updateSettings(settings);
    this.refresh();
  }
  registerEvents() {
    const debouncedRefresh = (0, import_obsidian.debounce)(() => this.refresh(), 500, true);
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
  async refresh() {
    if (!this.boardEl)
      return;
    const topics = await this.scanner.scanBoard();
    this.renderBoard(topics);
  }
  renderBoard(topics) {
    if (!this.boardEl)
      return;
    this.boardEl.empty();
    const header = this.boardEl.createDiv({ cls: "acta-task-header" });
    const titleRow = header.createDiv({ cls: "acta-task-title-row" });
    titleRow.createEl("h4", { text: "Task Board" });
    const refreshBtn = titleRow.createEl("button", {
      cls: "acta-task-refresh-btn clickable-icon",
      attr: { "aria-label": "Refresh" }
    });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.refresh());
    const totalTasks = topics.reduce((sum, t) => sum + t.totalCount, 0);
    const completedTasks = topics.reduce(
      (sum, t) => sum + t.completedCount,
      0
    );
    header.createDiv({
      cls: "acta-task-stats",
      text: `${completedTasks}/${totalTasks} done across ${topics.length} topics`
    });
    if (topics.length === 0) {
      this.boardEl.createDiv({
        cls: "acta-task-empty",
        text: "No tasks yet. Add checkboxes with inline hashtags (e.g. - [ ] #people do something) to see them here."
      });
      return;
    }
    const list = this.boardEl.createDiv({ cls: "acta-task-topics" });
    for (const topic of topics) {
      this.renderTopicSection(list, topic);
    }
  }
  renderTopicSection(parent, topic) {
    const section = parent.createDiv({ cls: "acta-task-topic-section" });
    const isCollapsed = this.collapsedTopics.has(topic.tag);
    const topicHeader = section.createDiv({
      cls: "acta-task-topic-header"
    });
    const chevron = topicHeader.createSpan({
      cls: `acta-task-chevron ${isCollapsed ? "is-collapsed" : ""}`
    });
    chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    topicHeader.createSpan({
      cls: "acta-task-topic-tag",
      text: `#${topic.displayTag}`
    });
    topicHeader.createSpan({
      cls: "acta-task-topic-count",
      text: `${topic.completedCount}/${topic.totalCount}`
    });
    topicHeader.addEventListener("click", () => {
      if (this.collapsedTopics.has(topic.tag)) {
        this.collapsedTopics.delete(topic.tag);
      } else {
        this.collapsedTopics.add(topic.tag);
      }
      this.refresh();
    });
    if (!isCollapsed) {
      const taskList = section.createDiv({ cls: "acta-task-list" });
      for (const task of topic.tasks) {
        if (!this.settings.showCompleted && task.completed)
          continue;
        this.renderTaskItem(taskList, task);
      }
    }
  }
  renderTaskItem(parent, task) {
    const item = parent.createDiv({
      cls: `acta-task-item ${task.completed ? "is-completed" : ""}`
    });
    const checkbox = item.createEl("input", {
      type: "checkbox",
      cls: "acta-task-checkbox task-list-item-checkbox"
    });
    checkbox.checked = task.completed;
    checkbox.addEventListener("click", async (e) => {
      e.preventDefault();
      const success = await this.toggler.toggleTask(task);
      if (!success) {
        console.error("Acta Task: Failed to toggle task", task.id);
      }
    });
    item.createSpan({
      cls: "acta-task-text",
      text: task.text
    });
    if (this.settings.showSourceNote) {
      const metaContainer = item.createSpan({
        cls: "acta-task-meta"
      });
      const badge = metaContainer.createSpan({
        cls: "acta-task-source-badge",
        text: task.fileName
      });
      badge.addEventListener("click", async (e) => {
        e.stopPropagation();
        const file = this.app.vault.getAbstractFileByPath(
          task.filePath
        );
        if (file instanceof import_obsidian.TFile) {
          await this.app.workspace.getLeaf(false).openFile(file, {
            eState: { line: task.line }
          });
        }
      });
      const date = new Date(task.addedAt);
      const dateStr = date.toLocaleDateString(void 0, {
        month: "short",
        day: "numeric"
      });
      metaContainer.createSpan({
        cls: "acta-task-date-badge",
        text: dateStr
      });
    }
    const removeBtn = item.createSpan({
      cls: "acta-task-remove-btn",
      text: "\xD7",
      attr: { title: "Remove from board" }
    });
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.taskManager.removeTask(task.id);
      this.refresh();
    });
  }
};

// src/feedbackBoardView.ts
var import_obsidian2 = require("obsidian");
var FeedbackBoardView = class extends import_obsidian2.ItemView {
  constructor(leaf, scanner, feedbackManager, settings) {
    super(leaf);
    this.collapsedTopics = /* @__PURE__ */ new Set();
    this.boardEl = null;
    this.scanner = scanner;
    this.feedbackManager = feedbackManager;
    this.settings = settings;
  }
  getViewType() {
    return ACTA_FEEDBACK_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u2764\uFE0F \u6B63\u53CD\u9988board";
  }
  getIcon() {
    return "heart";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("acta-task-container");
    this.boardEl = container.createDiv({ cls: "acta-task-board" });
    await this.refresh();
    this.registerEvents();
  }
  async onClose() {
  }
  updateSettings(settings) {
    this.settings = settings;
    this.scanner.updateSettings(settings);
    this.refresh();
  }
  registerEvents() {
    const debouncedRefresh = (0, import_obsidian2.debounce)(() => this.refresh(), 500, true);
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
  async refresh() {
    if (!this.boardEl)
      return;
    const topics = await this.scanner.scanBoard();
    this.renderBoard(topics);
  }
  renderBoard(topics) {
    if (!this.boardEl)
      return;
    this.boardEl.empty();
    const header = this.boardEl.createDiv({ cls: "acta-task-header" });
    const titleRow = header.createDiv({ cls: "acta-task-title-row" });
    titleRow.createEl("h4", { text: "\u2764\uFE0F \u6B63\u53CD\u9988board" });
    const refreshBtn = titleRow.createEl("button", {
      cls: "acta-task-refresh-btn clickable-icon",
      attr: { "aria-label": "Refresh" }
    });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.refresh());
    const totalItems = topics.reduce((sum, t) => sum + t.totalCount, 0);
    header.createDiv({
      cls: "acta-task-stats",
      text: `${totalItems} items across ${topics.length} topics`
    });
    if (topics.length === 0) {
      this.boardEl.createDiv({
        cls: "acta-task-empty",
        text: "No \u6B63\u53CD\u9988 items yet. Add notes with #\u6B63\u53CD\u9988 or #\u2764\uFE0F and a topic tag (e.g. #coding) to see them here."
      });
      return;
    }
    const list = this.boardEl.createDiv({ cls: "acta-task-topics" });
    for (const topic of topics) {
      this.renderTopicSection(list, topic);
    }
  }
  renderTopicSection(parent, topic) {
    const section = parent.createDiv({ cls: "acta-task-topic-section" });
    const isCollapsed = this.collapsedTopics.has(topic.tag);
    const topicHeader = section.createDiv({
      cls: "acta-task-topic-header"
    });
    const chevron = topicHeader.createSpan({
      cls: `acta-task-chevron ${isCollapsed ? "is-collapsed" : ""}`
    });
    chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    topicHeader.createSpan({
      cls: "acta-task-topic-tag",
      text: `#${topic.displayTag}`
    });
    topicHeader.createSpan({
      cls: "acta-task-topic-count",
      text: `${topic.totalCount}`
    });
    topicHeader.addEventListener("click", () => {
      if (this.collapsedTopics.has(topic.tag)) {
        this.collapsedTopics.delete(topic.tag);
      } else {
        this.collapsedTopics.add(topic.tag);
      }
      this.refresh();
    });
    if (!isCollapsed) {
      const itemList = section.createDiv({ cls: "acta-task-list" });
      for (const item of topic.items) {
        this.renderFeedbackItem(itemList, item);
      }
    }
  }
  renderFeedbackItem(parent, item) {
    const itemEl = parent.createDiv({
      cls: "acta-task-item acta-feedback-item"
    });
    itemEl.createSpan({
      cls: "acta-task-text acta-feedback-text",
      text: item.text
    });
    if (this.settings.showSourceNote) {
      const metaContainer = itemEl.createSpan({
        cls: "acta-task-meta"
      });
      const badge = metaContainer.createSpan({
        cls: "acta-task-source-badge",
        text: item.fileName
      });
      badge.addEventListener("click", async (e) => {
        e.stopPropagation();
        const file = this.app.vault.getAbstractFileByPath(
          item.filePath
        );
        if (file instanceof import_obsidian2.TFile) {
          await this.app.workspace.getLeaf(false).openFile(file, {
            eState: { line: item.line }
          });
        }
      });
      const date = new Date(item.addedAt);
      const dateStr = date.toLocaleDateString(void 0, {
        month: "short",
        day: "numeric"
      });
      metaContainer.createSpan({
        cls: "acta-task-date-badge",
        text: dateStr
      });
    }
    const removeBtn = itemEl.createSpan({
      cls: "acta-task-remove-btn",
      text: "\xD7",
      attr: { title: "Remove from board" }
    });
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.feedbackManager.removeFeedback(item.id);
      this.refresh();
    });
  }
};

// src/negativeFeedbackBoardView.ts
var import_obsidian3 = require("obsidian");
var NegativeFeedbackBoardView = class extends import_obsidian3.ItemView {
  constructor(leaf, scanner, negativeFeedbackManager, settings) {
    super(leaf);
    this.collapsedTopics = /* @__PURE__ */ new Set();
    this.boardEl = null;
    this.scanner = scanner;
    this.negativeFeedbackManager = negativeFeedbackManager;
    this.settings = settings;
  }
  getViewType() {
    return ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u{1F612} \u8D1F\u53CD\u9988board";
  }
  getIcon() {
    return "frown";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("acta-task-container");
    this.boardEl = container.createDiv({ cls: "acta-task-board acta-negative-feedback-board" });
    await this.refresh();
    this.registerEvents();
  }
  async onClose() {
  }
  updateSettings(settings) {
    this.settings = settings;
    this.scanner.updateSettings(settings);
    this.refresh();
  }
  registerEvents() {
    const debouncedRefresh = (0, import_obsidian3.debounce)(() => this.refresh(), 500, true);
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
  async refresh() {
    if (!this.boardEl)
      return;
    const topics = await this.scanner.scanBoard();
    this.renderBoard(topics);
  }
  renderBoard(topics) {
    if (!this.boardEl)
      return;
    this.boardEl.empty();
    const header = this.boardEl.createDiv({ cls: "acta-task-header" });
    const titleRow = header.createDiv({ cls: "acta-task-title-row" });
    titleRow.createEl("h4", { text: "\u{1F612} \u8D1F\u53CD\u9988board" });
    const refreshBtn = titleRow.createEl("button", {
      cls: "acta-task-refresh-btn clickable-icon",
      attr: { "aria-label": "Refresh" }
    });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.refresh());
    const totalItems = topics.reduce((sum, t) => sum + t.totalCount, 0);
    header.createDiv({
      cls: "acta-task-stats",
      text: `${totalItems} items across ${topics.length} topics`
    });
    if (topics.length === 0) {
      this.boardEl.createDiv({
        cls: "acta-task-empty",
        text: "No \u8D1F\u53CD\u9988 items yet. Add notes with #\u{1F612} and a topic tag (e.g. #work) to see them here."
      });
      return;
    }
    const list = this.boardEl.createDiv({ cls: "acta-task-topics" });
    for (const topic of topics) {
      this.renderTopicSection(list, topic);
    }
  }
  renderTopicSection(parent, topic) {
    const section = parent.createDiv({ cls: "acta-task-topic-section" });
    const isCollapsed = this.collapsedTopics.has(topic.tag);
    const topicHeader = section.createDiv({
      cls: "acta-task-topic-header"
    });
    const chevron = topicHeader.createSpan({
      cls: `acta-task-chevron ${isCollapsed ? "is-collapsed" : ""}`
    });
    chevron.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`;
    topicHeader.createSpan({
      cls: "acta-task-topic-tag",
      text: `#${topic.displayTag}`
    });
    topicHeader.createSpan({
      cls: "acta-task-topic-count",
      text: `${topic.totalCount}`
    });
    topicHeader.addEventListener("click", () => {
      if (this.collapsedTopics.has(topic.tag)) {
        this.collapsedTopics.delete(topic.tag);
      } else {
        this.collapsedTopics.add(topic.tag);
      }
      this.refresh();
    });
    if (!isCollapsed) {
      const itemList = section.createDiv({ cls: "acta-task-list" });
      for (const item of topic.items) {
        this.renderFeedbackItem(itemList, item);
      }
    }
  }
  renderFeedbackItem(parent, item) {
    const itemEl = parent.createDiv({
      cls: "acta-task-item acta-feedback-item acta-negative-feedback-item"
    });
    itemEl.createSpan({
      cls: "acta-task-text acta-feedback-text",
      text: item.text
    });
    if (this.settings.showSourceNote) {
      const metaContainer = itemEl.createSpan({
        cls: "acta-task-meta"
      });
      const badge = metaContainer.createSpan({
        cls: "acta-task-source-badge",
        text: item.fileName
      });
      badge.addEventListener("click", async (e) => {
        e.stopPropagation();
        const file = this.app.vault.getAbstractFileByPath(
          item.filePath
        );
        if (file instanceof import_obsidian3.TFile) {
          await this.app.workspace.getLeaf(false).openFile(file, {
            eState: { line: item.line }
          });
        }
      });
      const date = new Date(item.addedAt);
      const dateStr = date.toLocaleDateString(void 0, {
        month: "short",
        day: "numeric"
      });
      metaContainer.createSpan({
        cls: "acta-task-date-badge",
        text: dateStr
      });
    }
    const removeBtn = itemEl.createSpan({
      cls: "acta-task-remove-btn",
      text: "\xD7",
      attr: { title: "Remove from board" }
    });
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await this.negativeFeedbackManager.removeFeedback(item.id);
      this.refresh();
    });
  }
};

// src/northStarBoardView.ts
var import_obsidian5 = require("obsidian");

// src/northStarGoalModal.ts
var import_obsidian4 = require("obsidian");
var NorthStarGoalModal = class extends import_obsidian4.Modal {
  constructor(app, onSubmit) {
    super(app);
    this.goalText = "";
    this.timeWindowDays = 30;
    this.onSubmit = onSubmit;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h3", { text: "Set Your North Star" });
    contentEl.createEl("p", {
      text: "Define your goal and lock it in. The goal cannot be changed \u2014 only archived and replaced.",
      cls: "setting-item-description"
    });
    new import_obsidian4.Setting(contentEl).setName("Goal").setDesc("What are you working toward?").addTextArea(
      (text) => text.setPlaceholder("e.g., Land a Post-Training Research Engineer role").onChange((value) => {
        this.goalText = value;
      })
    );
    new import_obsidian4.Setting(contentEl).setName("Time window (days)").setDesc("How many days to reach this goal?").addText(
      (text) => text.setPlaceholder("30").setValue("30").onChange((value) => {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
          this.timeWindowDays = num;
        }
      })
    );
    new import_obsidian4.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Lock It In").setCta().onClick(() => {
        if (this.goalText.trim().length === 0)
          return;
        this.onSubmit(this.goalText.trim(), this.timeWindowDays);
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/northStarBoardView.ts
var TOOL_DEFINITIONS = [
  {
    name: "get_today_date",
    description: "Get today's local date, day number, and whether a check-in already exists for today. Always call this first before observe_signals or run_assessment.",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "observe_signals",
    description: "Scan the vault for signals on a given date: tasks, feedback, reflections, and vault activity. Call get_today_date first, then pass the date here.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date to observe in YYYY-MM-DD format (from get_today_date)"
        }
      },
      required: ["date"]
    }
  },
  {
    name: "run_assessment",
    description: "Run an LLM alignment assessment on collected signals. Call observe_signals first. Pass the same date.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date for this assessment in YYYY-MM-DD format (from get_today_date)"
        }
      },
      required: ["date"]
    }
  },
  {
    name: "save_conversation_summary",
    description: "Summarize the current Tinker conversation and append it to today's check-in note. Call this when the user asks to summarize, capture takeaways, or save conversation notes. Write the summary in markdown with key insights, action items, and decisions.",
    input_schema: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "The date of the check-in note to append to, in YYYY-MM-DD format (from get_today_date)"
        },
        summary: {
          type: "string",
          description: "The conversation summary in markdown. Include: key insights, action items, and any decisions made. Use bullet points and keep it concise. If rewriting an existing summary, produce a single unified summary that merges old and new insights."
        },
        overwrite: {
          type: "boolean",
          description: "Set to true when rewriting an existing summary with merged content. On first call, omit this \u2014 the tool will return existing content for you to merge."
        }
      },
      required: ["date", "summary"]
    }
  },
  {
    name: "get_assessment_history",
    description: "Retrieve past assessments for trend analysis.",
    input_schema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of recent assessments to retrieve (default 5)"
        }
      },
      required: []
    }
  }
];
var NorthStarBoardView = class extends import_obsidian5.ItemView {
  constructor(leaf, manager, agent, llmClient, settings) {
    super(leaf);
    this.boardEl = null;
    this.isSending = false;
    this.chatMessagesEl = null;
    this.lastObservedSignals = null;
    this.manager = manager;
    this.agent = agent;
    this.llmClient = llmClient;
    this.settings = settings;
  }
  getViewType() {
    return ACTA_NORTHSTAR_VIEW_TYPE;
  }
  getDisplayText() {
    return "North Star";
  }
  getIcon() {
    return "star";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("acta-task-container");
    this.boardEl = container.createDiv({ cls: "acta-northstar-board" });
    this.renderBoard();
  }
  async onClose() {
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  refresh() {
    if (!this.isSending) {
      this.renderBoard();
    }
  }
  getLocalDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  renderBoard() {
    if (!this.boardEl)
      return;
    this.boardEl.empty();
    this.chatMessagesEl = null;
    const goal = this.manager.getGoal();
    this.renderHeader();
    if (!goal) {
      this.renderEmptyGoalState();
      return;
    }
    this.renderGoalCard();
    this.renderTinkerChat();
  }
  renderHeader() {
    if (!this.boardEl)
      return;
    const header = this.boardEl.createDiv({ cls: "acta-northstar-header" });
    const titleRow = header.createDiv({ cls: "acta-northstar-title-row" });
    titleRow.createEl("h4", { text: "North Star" });
    const btnGroup = titleRow.createDiv({ cls: "acta-northstar-btn-group" });
    const refreshBtn = btnGroup.createEl("button", {
      cls: "acta-northstar-refresh-btn clickable-icon",
      attr: { "aria-label": "Refresh" }
    });
    refreshBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`;
    refreshBtn.addEventListener("click", () => this.refresh());
  }
  renderEmptyGoalState() {
    if (!this.boardEl)
      return;
    const empty = this.boardEl.createDiv({ cls: "acta-northstar-empty" });
    empty.createEl("p", { text: "No goal set yet." });
    const setBtn = empty.createEl("button", {
      cls: "acta-northstar-set-goal-btn",
      text: "Set Your North Star"
    });
    setBtn.addEventListener("click", () => this.openGoalModal());
  }
  renderGoalCard() {
    if (!this.boardEl)
      return;
    const goal = this.manager.getGoal();
    if (!goal)
      return;
    const card = this.boardEl.createDiv({ cls: "acta-northstar-goal-card" });
    const goalText = card.createDiv({ cls: "acta-northstar-goal-text" });
    goalText.createEl("span", { text: goal.text });
    const badges = card.createDiv({ cls: "acta-northstar-goal-badges" });
    const dayNum = this.manager.getDayNumber();
    badges.createEl("span", {
      cls: "acta-northstar-badge",
      text: `Day ${dayNum} of ${goal.timeWindowDays}`
    });
    badges.createEl("span", {
      cls: "acta-northstar-badge acta-northstar-badge-phase",
      text: goal.currentPhase
    });
    const daysLeft = this.manager.getDaysLeft();
    badges.createEl("span", {
      cls: `acta-northstar-badge ${daysLeft <= 7 ? "acta-northstar-badge-urgent" : ""}`,
      text: `${daysLeft}d left`
    });
  }
  formatCategoryName(category) {
    const names = {
      goalDirectDeepWork: "Goal-Direct Deep Work",
      taskCompletion: "Task Completion",
      reflectionDepth: "Reflection Depth",
      pipelineActivity: "Pipeline Activity",
      feedbackSignals: "Feedback Signals"
    };
    return names[category] || category;
  }
  openGoalModal() {
    new NorthStarGoalModal(this.app, async (text, days) => {
      await this.manager.setGoal(text, days);
      new import_obsidian5.Notice("North Star goal locked in!");
      this.renderBoard();
    }).open();
  }
  // ── Check-in note creation ──
  async createCheckInNote(assessment) {
    const goal = this.manager.getGoal();
    if (!goal)
      return;
    const folderPath = "NorthStar/check-ins";
    const filePath = `${folderPath}/North Star Check-in \u2014 ${assessment.date}.md`;
    if (!this.app.vault.getAbstractFileByPath(folderPath)) {
      await this.app.vault.createFolder(folderPath);
    }
    const scoreColor = (pct) => pct >= 70 ? "#27ae60" : pct >= 40 ? "#f39c12" : "#e74c3c";
    const buildBar = (pct) => {
      const color = scoreColor(pct);
      return `<div style="height:6px;background:#e0e0e0;border-radius:3px;overflow:hidden;margin:4px 0 6px 0"><div style="height:100%;width:${Math.min(100, Math.max(0, pct))}%;background:${color};border-radius:3px"></div></div>`;
    };
    const overallPct = assessment.overallScore;
    const overallColor = scoreColor(overallPct);
    const breakdownHtml = assessment.signalBreakdown.map((s) => {
      const pct = s.maxScore > 0 ? Math.round(s.score / s.maxScore * 100) : 0;
      return `<div style="margin-bottom:14px">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px"><span style="font-weight:500;font-size:0.9em">${this.formatCategoryName(s.category)}</span><span style="font-size:0.85em;color:#888">${Math.round(s.score)}/${Math.round(s.maxScore)}</span></div>
${buildBar(pct)}
<div style="font-size:0.82em;color:#888;line-height:1.3">${s.reasoning}</div>
</div>`;
    }).join("\n");
    const driftHtml = assessment.driftIndicators.length > 0 ? assessment.driftIndicators.map((d) => `<div style="border-left:2px solid #e74c3c;padding:6px 10px;margin-bottom:4px;font-size:0.9em;background:rgba(231,76,60,0.06);border-radius:0 4px 4px 0">${d}</div>`).join("\n") : `<div style="font-size:0.9em;color:#888">None</div>`;
    const momentumHtml = assessment.momentumIndicators.length > 0 ? assessment.momentumIndicators.map((m) => `<div style="border-left:2px solid #27ae60;padding:6px 10px;margin-bottom:4px;font-size:0.9em;background:rgba(39,174,96,0.06);border-radius:0 4px 4px 0">${m}</div>`).join("\n") : `<div style="font-size:0.9em;color:#888">None</div>`;
    const content = `**Goal:** ${goal.text}
**Day ${assessment.dayNumber} of ${goal.timeWindowDays}** | Phase: ${goal.currentPhase}

<div style="text-align:center;padding:12px 0 4px 0">
<span style="font-size:2.5em;font-weight:700;color:${overallColor}">${assessment.overallScore}</span><span style="font-size:1em;color:#888">/100</span>
<div style="font-size:0.8em;color:#888;margin-top:4px">Day ${assessment.dayNumber} \u2014 ${assessment.date}</div>
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
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(filePath, content);
    }
  }
  // ── Check-in note link (inline in chat) ──
  renderCheckInLink(parent, assessment) {
    const notePath = `NorthStar/check-ins/North Star Check-in \u2014 ${assessment.date}.md`;
    const link = parent.createDiv({ cls: "acta-northstar-checkin-link" });
    const scoreClass = assessment.overallScore >= 70 ? "acta-northstar-score-good" : assessment.overallScore >= 40 ? "acta-northstar-score-mid" : "acta-northstar-score-low";
    link.createEl("span", { cls: `acta-northstar-checkin-score ${scoreClass}`, text: `${assessment.overallScore}/100` });
    link.createEl("span", { cls: "acta-northstar-checkin-label", text: ` \u2014 Day ${assessment.dayNumber} Check-in` });
    link.createEl("span", { cls: "acta-northstar-checkin-open", text: "Open note \u2197" });
    link.addEventListener("click", () => {
      this.app.workspace.openLinkText(notePath, "", false);
    });
  }
  // ── Tinker Chat ──
  renderTinkerChat() {
    if (!this.boardEl)
      return;
    const container = this.boardEl.createDiv({ cls: "acta-northstar-tinker-container" });
    container.createEl("h5", { text: "Tinker" });
    const messagesEl = container.createDiv({ cls: "acta-northstar-tinker-messages" });
    this.chatMessagesEl = messagesEl;
    const messages = this.manager.getTinkerMessages();
    for (const msg of messages) {
      if (msg.assessmentId) {
        const assessment = this.manager.getAssessments().find((a) => a.id === msg.assessmentId);
        if (assessment) {
          this.renderCheckInLink(messagesEl, assessment);
        }
      }
      this.appendMessageBubble(messagesEl, msg);
    }
    const inputContainer = container.createDiv({ cls: "acta-northstar-input-container" });
    const inputBox = inputContainer.createDiv({ cls: "acta-northstar-input-box" });
    const textarea = inputBox.createEl("textarea", {
      cls: "acta-northstar-input",
      attr: { placeholder: "Ask Tinker about your goal...", rows: "3" }
    });
    const toolbar = inputBox.createDiv({ cls: "acta-northstar-input-toolbar" });
    const models = [
      { value: "claude-haiku-4-5-20251001", label: "Haiku" },
      { value: "claude-sonnet-4-20250514", label: "Sonnet" },
      { value: "claude-opus-4-6", label: "Opus" }
    ];
    const currentModel = models.find((m) => m.value === this.settings.northStarModel);
    const modelSelector = toolbar.createDiv({ cls: "acta-northstar-model-selector" });
    const modelBtn = modelSelector.createDiv({ cls: "acta-northstar-model-btn" });
    const modelLabel = modelBtn.createEl("span", { text: (currentModel == null ? void 0 : currentModel.label) || "Sonnet" });
    modelBtn.createEl("span", { cls: "acta-northstar-model-chevron", text: "\u25B4" });
    const dropdown = modelSelector.createDiv({ cls: "acta-northstar-model-dropdown" });
    for (const m of models) {
      const option = dropdown.createDiv({
        cls: `acta-northstar-model-option ${m.value === this.settings.northStarModel ? "is-selected" : ""}`,
        text: m.label
      });
      option.addEventListener("click", () => {
        this.settings.northStarModel = m.value;
        modelLabel.textContent = m.label;
        dropdown.querySelectorAll(".acta-northstar-model-option").forEach((el) => el.removeClass("is-selected"));
        option.addClass("is-selected");
      });
    }
    const sendBtn = toolbar.createEl("button", {
      cls: "acta-northstar-send-btn",
      attr: { "aria-label": "Send" }
    });
    sendBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;
    const doSend = () => {
      const text = textarea.value.trim();
      if (!text || this.isSending)
        return;
      textarea.value = "";
      this.sendTinkerMessage(text, messagesEl, textarea, sendBtn);
    };
    sendBtn.addEventListener("click", doSend);
    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    });
    requestAnimationFrame(() => {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }
  appendMessageBubble(container, msg) {
    const bubble = container.createDiv({
      cls: `acta-northstar-tinker-bubble acta-northstar-tinker-bubble-${msg.role}`
    });
    const contentEl = bubble.createDiv({ cls: "acta-northstar-tinker-bubble-content" });
    import_obsidian5.MarkdownRenderer.renderMarkdown(msg.content, contentEl, "", this);
    return bubble;
  }
  // ── Tool step indicators ──
  renderToolStep(container, label) {
    const step = container.createDiv({ cls: "acta-northstar-tool-step" });
    const indicator = step.createSpan({ cls: "acta-northstar-step-indicator" });
    indicator.textContent = "\u25CF";
    step.createSpan({ cls: "acta-northstar-step-label", text: label });
    step.addClass("acta-northstar-step-running");
    container.scrollTop = container.scrollHeight;
    return step;
  }
  renderToolSubstep(parent, text, status) {
    const sub = parent.createDiv({ cls: "acta-northstar-tool-substep" });
    const indicator = sub.createSpan({ cls: "acta-northstar-step-indicator" });
    indicator.textContent = status === "done" ? "\u2713" : "\u25CF";
    sub.createSpan({ cls: "acta-northstar-step-label", text });
    sub.addClass(status === "done" ? "acta-northstar-step-done" : "acta-northstar-step-running");
    return sub;
  }
  completeToolStep(stepEl, detail) {
    stepEl.removeClass("acta-northstar-step-running");
    stepEl.addClass("acta-northstar-step-done");
    const indicator = stepEl.querySelector(".acta-northstar-step-indicator");
    if (indicator)
      indicator.textContent = "\u2713";
    if (detail) {
      stepEl.createSpan({ cls: "acta-northstar-step-detail", text: ` \u2014 ${detail}` });
    }
  }
  // ── Typing indicator helpers ──
  addTypingIndicator(messagesEl) {
    const typingEl = messagesEl.createDiv({ cls: "acta-northstar-tinker-typing" });
    typingEl.createSpan({ cls: "acta-northstar-tinker-dot" });
    typingEl.createSpan({ cls: "acta-northstar-tinker-dot" });
    typingEl.createSpan({ cls: "acta-northstar-tinker-dot" });
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return typingEl;
  }
  // ── Tool execution ──
  async executeTool(toolName, toolInput, messagesEl) {
    switch (toolName) {
      case "get_today_date": {
        const today = this.getLocalDateStr();
        const dayNumber = this.manager.getDayNumber();
        const existing = this.manager.getAssessments().find((a) => a.date === today);
        const hasCheckin = !!existing;
        return {
          result: `Today is ${today}. Day ${dayNumber}. ${hasCheckin ? `A check-in already exists for today (score: ${existing.overallScore}/100). Running again will update it in place.` : "No check-in yet for today."}`
        };
      }
      case "observe_signals": {
        const dateStr = toolInput.date || this.getLocalDateStr();
        const stepEl = this.renderToolStep(messagesEl, `Observing vault signals for ${dateStr}...`);
        const signals = await this.agent.observeSignals(dateStr, (stepId, status, detail) => {
          if (status === "done") {
            this.renderToolSubstep(stepEl, `${stepId} \u2014 ${detail}`, "done");
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
        const dateStr = toolInput.date || this.getLocalDateStr();
        const stepEl = this.renderToolStep(messagesEl, "Running alignment assessment...");
        const assessment = await this.agent.assessSignals(dateStr, this.lastObservedSignals);
        this.completeToolStep(stepEl, `Score: ${assessment.overallScore}/100`);
        await this.createCheckInNote(assessment);
        this.renderCheckInLink(messagesEl, assessment);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        const result = `Assessment complete. Score: ${assessment.overallScore}/100 (Day ${assessment.dayNumber}). Drift: ${assessment.driftIndicators.join("; ") || "None"}. Momentum: ${assessment.momentumIndicators.join("; ") || "None"}.`;
        return { result, assessment };
      }
      case "save_conversation_summary": {
        const dateStr = toolInput.date || this.getLocalDateStr();
        const summary = toolInput.summary;
        const overwrite = toolInput.overwrite;
        if (!summary) {
          return { result: "Error: No summary content provided." };
        }
        const folderPath = "NorthStar/check-ins";
        const filePath = `${folderPath}/North Star Check-in \u2014 ${dateStr}.md`;
        const existingFile = this.app.vault.getAbstractFileByPath(filePath);
        if (existingFile && !overwrite) {
          const currentContent = await this.app.vault.read(existingFile);
          const marker = "## Conversation Notes";
          const markerIdx = currentContent.indexOf(marker);
          if (markerIdx >= 0) {
            const existingSummary = currentContent.substring(markerIdx + marker.length).trim();
            return {
              result: `EXISTING CONVERSATION NOTES FOUND for ${dateStr}:

${existingSummary}

You must merge the old notes with the new conversation insights into a single unified summary. Call save_conversation_summary again with overwrite: true and a rewritten summary that incorporates BOTH the previous notes and the current conversation.`
            };
          }
        }
        const stepEl = this.renderToolStep(messagesEl, "Saving conversation notes...");
        const summaryBlock = `

---

## Conversation Notes

${summary}
`;
        if (existingFile) {
          const currentContent = await this.app.vault.read(existingFile);
          const marker = "## Conversation Notes";
          const markerIdx = currentContent.indexOf(marker);
          if (markerIdx >= 0) {
            const beforeMarker = currentContent.lastIndexOf("---", markerIdx);
            const trimPoint = beforeMarker >= 0 ? beforeMarker : markerIdx;
            const updated = currentContent.substring(0, trimPoint).trimEnd() + summaryBlock;
            await this.app.vault.modify(existingFile, updated);
          } else {
            await this.app.vault.modify(existingFile, currentContent.trimEnd() + summaryBlock);
          }
          this.completeToolStep(stepEl, "Updated check-in note with conversation notes");
        } else {
          if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            await this.app.vault.createFolder(folderPath);
          }
          const goal = this.manager.getGoal();
          const goalText = goal ? goal.text : "No goal set";
          const content = `**Goal:** ${goalText}
${summaryBlock}`;
          await this.app.vault.create(filePath, content);
          this.completeToolStep(stepEl, "Created check-in note with conversation notes");
        }
        const latestAssessment = this.manager.getAssessments().find((a) => a.date === dateStr);
        if (latestAssessment) {
          this.renderCheckInLink(messagesEl, latestAssessment);
        } else {
          const notePath = filePath;
          const link = messagesEl.createDiv({ cls: "acta-northstar-checkin-link" });
          link.createEl("span", { cls: "acta-northstar-checkin-label", text: `Check-in \u2014 ${dateStr}` });
          link.createEl("span", { cls: "acta-northstar-checkin-open", text: "Open note \u2197" });
          link.addEventListener("click", () => {
            this.app.workspace.openLinkText(notePath, "", false);
          });
        }
        messagesEl.scrollTop = messagesEl.scrollHeight;
        return { result: `Conversation summary saved to check-in note for ${dateStr}.` };
      }
      case "get_assessment_history": {
        const count = toolInput.count || 5;
        const assessments = this.manager.getAssessments();
        const recent = assessments.slice(-count);
        if (recent.length === 0) {
          return { result: "No assessment history available." };
        }
        const lines = recent.map(
          (a) => `Day ${a.dayNumber} (${a.date}): ${a.overallScore}/100`
        );
        return { result: `Assessment history (last ${recent.length}):
${lines.join("\n")}` };
      }
      default:
        return { result: `Unknown tool: ${toolName}` };
    }
  }
  // ── Agentic loop ──
  async sendTinkerMessage(text, messagesEl, textarea, sendBtn) {
    this.isSending = true;
    textarea.disabled = true;
    sendBtn.disabled = true;
    sendBtn.addClass("is-disabled");
    const userMsg = { role: "user", content: text, timestamp: Date.now() };
    await this.manager.addTinkerMessage(userMsg);
    this.appendMessageBubble(messagesEl, userMsg);
    let typingEl = this.addTypingIndicator(messagesEl);
    let producedAssessment = null;
    try {
      const systemPrompt = this.buildTinkerSystemPrompt();
      const apiMessages = this.manager.getTinkerMessages().map((m) => ({
        role: m.role,
        content: m.content
      }));
      let maxIterations = 10;
      while (maxIterations-- > 0) {
        const response = await this.llmClient.chatWithTools(systemPrompt, apiMessages, TOOL_DEFINITIONS);
        apiMessages.push({ role: "assistant", content: response.content });
        if (response.stop_reason === "end_turn") {
          const textParts = response.content.filter((b) => b.type === "text").map((b) => b.text);
          const finalText = textParts.join("\n").trim();
          typingEl.remove();
          if (finalText) {
            const assistantMsg = {
              role: "assistant",
              content: finalText,
              timestamp: Date.now(),
              assessmentId: producedAssessment == null ? void 0 : producedAssessment.id
            };
            await this.manager.addTinkerMessage(assistantMsg);
            this.appendMessageBubble(messagesEl, assistantMsg);
          }
          break;
        }
        if (response.stop_reason === "tool_use") {
          typingEl.remove();
          const toolUseBlocks = response.content.filter(
            (b) => b.type === "tool_use"
          );
          const toolResults = [];
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
                content: result
              });
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : "Unknown error";
              toolResults.push({
                type: "tool_result",
                tool_use_id: toolBlock.id,
                content: `Error: ${errorMsg}`,
                is_error: true
              });
            }
          }
          apiMessages.push({ role: "user", content: toolResults });
          typingEl = this.addTypingIndicator(messagesEl);
          continue;
        }
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
  buildTinkerSystemPrompt() {
    const goal = this.manager.getGoal();
    if (!goal)
      return "No active goal.";
    const dayNumber = this.manager.getDayNumber();
    const daysLeft = this.manager.getDaysLeft();
    const latest = this.manager.getLatestAssessment();
    let assessmentBlock = "No assessment yet.";
    if (latest) {
      const breakdownLines = latest.signalBreakdown.map(
        (s) => `- ${this.formatCategoryName(s.category)}: ${Math.round(s.score)}/${Math.round(s.maxScore)} \u2014 ${s.reasoning}`
      ).join("\n");
      const driftLines = latest.driftIndicators.length > 0 ? latest.driftIndicators.map((d) => `- ${d}`).join("\n") : "- None";
      const momentumLines = latest.momentumIndicators.length > 0 ? latest.momentumIndicators.map((m) => `- ${m}`).join("\n") : "- None";
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
- Be direct and specific \u2014 reference actual tasks, scores, and signals
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
2. Call save_conversation_summary with a markdown summary of the conversation \u2014 include key insights, action items, and decisions
3. The summary will be appended to that day's check-in note

IMPORTANT for save_conversation_summary:
- Write the summary in the SAME language(s) the conversation used. If the user spoke in Chinese, summarize in Chinese. If mixed (e.g. Chinese + English), keep that mix. Preserve the original voice and expressions \u2014 do not translate.
- Do NOT include a title/heading in the summary \u2014 the "## Conversation Notes" heading is added automatically. Start directly with the content (e.g. bullet points, sections with ### subheadings).

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
};

// src/settings.ts
var import_obsidian6 = require("obsidian");
var ActaTaskSettingTab = class extends import_obsidian6.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Acta Task Settings" });
    containerEl.createEl("p", {
      text: "Tasks with inline hashtags (e.g. - [ ] #people do something) are automatically tracked on the board.",
      cls: "setting-item-description"
    });
    new import_obsidian6.Setting(containerEl).setName("Excluded tags").setDesc(
      "Comma-separated list of tags to exclude (e.g. #daily, #template)"
    ).addText(
      (text) => text.setPlaceholder("#daily, #template").setValue(this.plugin.settings.excludedTags.join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedTags = value.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0).map((t) => t.startsWith("#") ? t : "#" + t);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Excluded folders").setDesc(
      "Comma-separated list of folders to exclude (e.g. templates, archive)"
    ).addText(
      (text) => text.setPlaceholder("templates, archive").setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Show completed tasks").setDesc("Display completed tasks in the board").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showCompleted).onChange(async (value) => {
        this.plugin.settings.showCompleted = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Show source note").setDesc("Display the source note name next to each task").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showSourceNote).onChange(async (value) => {
        this.plugin.settings.showSourceNote = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Topic sort order").setDesc("How to sort topic sections").addDropdown(
      (dropdown) => dropdown.addOption("alphabetical", "Alphabetical").addOption("taskCount", "Task count (most first)").setValue(this.plugin.settings.topicSortOrder).onChange(async (value) => {
        this.plugin.settings.topicSortOrder = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Task sort order").setDesc("How to sort tasks within a topic").addDropdown(
      (dropdown) => dropdown.addOption("incompleteFirst", "Incomplete first").addOption("byFile", "By file").setValue(this.plugin.settings.taskSortOrder).onChange(async (value) => {
        this.plugin.settings.taskSortOrder = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "North Star" });
    new import_obsidian6.Setting(containerEl).setName("Anthropic API key").setDesc("Required for North Star alignment assessments").addText(
      (text) => text.setPlaceholder("sk-ant-...").setValue(this.plugin.settings.anthropicApiKey).then((t) => {
        t.inputEl.type = "password";
      }).onChange(async (value) => {
        this.plugin.settings.anthropicApiKey = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian6.Setting(containerEl).setName("Model").setDesc("Claude model for assessments").addDropdown(
      (dropdown) => dropdown.addOption("claude-sonnet-4-20250514", "Claude Sonnet 4").addOption("claude-haiku-4-5-20251001", "Claude Haiku 4.5").addOption("claude-opus-4-6", "Claude Opus 4.6").setValue(this.plugin.settings.northStarModel).onChange(async (value) => {
        this.plugin.settings.northStarModel = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/taskManager.ts
var import_obsidian7 = require("obsidian");
var TASK_REGEX_BASE = /^[\s]*[-*]\s+\[([ xX])\]\s*/;
var INLINE_TAG_REGEX = /#[\w\-\/]+/g;
var TaskManager = class {
  constructor(app, settings, data, saveData) {
    this.app = app;
    this.settings = settings;
    this.data = data;
    this.saveData = saveData;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  updateData(data) {
    this.data = data;
  }
  /**
   * Check if a line contains a task with inline hashtag
   */
  hasInlineTag(line) {
    const match = line.match(TASK_REGEX_BASE);
    if (!match)
      return false;
    const textAfterCheckbox = line.substring(match[0].length);
    return INLINE_TAG_REGEX.test(textAfterCheckbox);
  }
  /**
   * Extract inline tags from task text
   */
  extractInlineTags(text) {
    const matches = text.match(INLINE_TAG_REGEX);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }
  /**
   * Parse task from line (returns null if not a valid task with inline tag)
   */
  parseTaskFromLine(line, lineNumber, file) {
    const match = line.match(TASK_REGEX_BASE);
    if (!match)
      return null;
    const textAfterCheckbox = line.substring(match[0].length).trim();
    const inlineTags = this.extractInlineTags(textAfterCheckbox);
    if (inlineTags.length === 0)
      return null;
    const completed = match[1].toLowerCase() === "x";
    const displayText = textAfterCheckbox.replace(INLINE_TAG_REGEX, "").trim();
    return {
      id: `${file.path}:${lineNumber}`,
      text: displayText,
      completed,
      filePath: file.path,
      fileName: file.basename,
      line: lineNumber,
      tags: inlineTags,
      addedAt: Date.now()
    };
  }
  /**
   * Add task to board (with confirmation)
   */
  async addTask(task) {
    if (this.data.addedTasks[task.id]) {
      new import_obsidian7.Notice("Task is already on the board");
      return false;
    }
    this.data.addedTasks[task.id] = task;
    await this.saveData();
    new import_obsidian7.Notice("Task added to board");
    return true;
  }
  /**
   * Add task silently (no notice)
   */
  async addTaskSilently(task) {
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
  async removeTask(taskId) {
    if (!this.data.addedTasks[taskId])
      return;
    delete this.data.addedTasks[taskId];
    await this.saveData();
    new import_obsidian7.Notice("Task removed from board");
  }
  /**
   * Check if task is already added
   */
  isTaskAdded(taskId) {
    return !!this.data.addedTasks[taskId];
  }
  /**
   * Get all added tasks (synced with current file state)
   */
  async getAddedTasks() {
    const tasks = [];
    const toRemove = [];
    for (const [taskId, task] of Object.entries(this.data.addedTasks)) {
      const file = this.app.vault.getAbstractFileByPath(task.filePath);
      if (!(file instanceof import_obsidian7.TFile)) {
        toRemove.push(taskId);
        continue;
      }
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
      const updatedTask = this.parseTaskFromLine(line, task.line, file);
      if (updatedTask) {
        updatedTask.addedAt = task.addedAt;
        tasks.push(updatedTask);
      } else {
        toRemove.push(taskId);
      }
    }
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
  async getTaskAtPosition(file, line) {
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    if (line >= lines.length)
      return null;
    return this.parseTaskFromLine(lines[line], line, file);
  }
};

// src/taskScanner.ts
var TaskScanner = class {
  constructor(app, taskManager, settings) {
    this.app = app;
    this.taskManager = taskManager;
    this.settings = settings;
  }
  updateSettings(settings) {
    this.settings = settings;
    this.taskManager.updateSettings(settings);
  }
  async scanBoard() {
    await this.autoAddMarkedTasks();
    const tasks = await this.taskManager.getAddedTasks();
    return this.buildTopicGroups(tasks);
  }
  async autoAddMarkedTasks() {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!this.taskManager.hasInlineTag(line))
          continue;
        const taskId = `${file.path}:${i}`;
        if (this.taskManager.isTaskAdded(taskId))
          continue;
        const task = this.taskManager.parseTaskFromLine(line, i, file);
        if (task) {
          await this.taskManager.addTaskSilently(task);
        }
      }
    }
  }
  buildTopicGroups(tasks) {
    const tagTaskMap = /* @__PURE__ */ new Map();
    for (const task of tasks) {
      for (const tag of task.tags) {
        const normalizedTag = tag.toLowerCase();
        if (this.settings.excludedTags.includes(normalizedTag))
          continue;
        if (!tagTaskMap.has(normalizedTag)) {
          tagTaskMap.set(normalizedTag, []);
        }
        tagTaskMap.get(normalizedTag).push(task);
      }
    }
    const groups = [];
    for (const [tag, tasks2] of tagTaskMap) {
      const sortedTasks = this.sortTasks(tasks2);
      groups.push({
        tag,
        displayTag: tag.replace(/^#/, ""),
        tasks: sortedTasks,
        completedCount: sortedTasks.filter((t) => t.completed).length,
        totalCount: sortedTasks.length
      });
    }
    return this.sortTopics(groups);
  }
  sortTasks(tasks) {
    if (this.settings.taskSortOrder === "incompleteFirst") {
      return tasks.sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return a.addedAt - b.addedAt;
      });
    }
    return tasks.sort(
      (a, b) => a.filePath.localeCompare(b.filePath) || a.line - b.line
    );
  }
  sortTopics(groups) {
    if (this.settings.topicSortOrder === "taskCount") {
      return groups.sort((a, b) => b.totalCount - a.totalCount);
    }
    return groups.sort(
      (a, b) => a.displayTag.localeCompare(b.displayTag)
    );
  }
};

// src/taskToggler.ts
var import_obsidian8 = require("obsidian");
var CHECKBOX_REGEX = /^([\s]*[-*]\s+\[)([ xX])(\]\s*.*)/;
var TaskToggler = class {
  constructor(app) {
    this.app = app;
  }
  async toggleTask(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof import_obsidian8.TFile))
      return false;
    const content = await this.app.vault.read(file);
    const lines = content.split("\n");
    if (task.line < 0 || task.line >= lines.length)
      return false;
    const line = lines[task.line];
    const match = line.match(CHECKBOX_REGEX);
    if (!match)
      return false;
    const currentState = match[2].toLowerCase();
    const newState = currentState === "x" ? " " : "x";
    lines[task.line] = match[1] + newState + match[3];
    await this.app.vault.modify(file, lines.join("\n"));
    return true;
  }
};

// src/feedbackManager.ts
var import_obsidian9 = require("obsidian");
var TAG_REGEX = /#[\w\-\/\u4e00-\u9fa5❤️]+/g;
var FeedbackManager = class {
  constructor(app, settings, data, saveData) {
    this.app = app;
    this.settings = settings;
    this.data = data;
    this.saveData = saveData;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  updateData(data) {
    this.data = data;
  }
  /**
   * Extract all tags from text
   */
  extractTags(text) {
    const matches = text.match(TAG_REGEX);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }
  /**
   * Check if a line has the feedback trigger tag
   */
  hasFeedbackTag(line) {
    const tags = this.extractTags(line);
    return FEEDBACK_TRIGGER_TAGS.some(
      (triggerTag) => tags.includes(triggerTag.toLowerCase())
    );
  }
  /**
   * Check if a line is a list item (- or * prefix)
   */
  isListItem(line) {
    return /^[\s]*[-*]\s+/.test(line);
  }
  /**
   * Parse feedback item from a line
   */
  parseFeedbackFromLine(line, lineNumber, file) {
    if (!this.isListItem(line)) {
      return null;
    }
    if (!this.hasFeedbackTag(line)) {
      return null;
    }
    const allTags = this.extractTags(line);
    const topicTags = allTags.filter((tag) => {
      const isTriggerTag = FEEDBACK_TRIGGER_TAGS.some(
        (triggerTag) => tag === triggerTag.toLowerCase()
      );
      return !isTriggerTag && !this.settings.excludedTags.includes(tag);
    });
    const displayText = line.replace(/^[\s]*[-*]\s+/, "").replace(TAG_REGEX, "").trim();
    return {
      id: `${file.path}:${lineNumber}`,
      text: displayText,
      filePath: file.path,
      fileName: file.basename,
      line: lineNumber,
      tags: topicTags,
      addedAt: Date.now()
    };
  }
  /**
   * Get feedback item at a specific line
   */
  async getFeedbackAtPosition(file, line) {
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    if (line >= lines.length)
      return null;
    return this.parseFeedbackFromLine(lines[line], line, file);
  }
  /**
   * Add feedback item silently (no notice)
   */
  async addFeedbackSilently(item) {
    if (this.data.addedFeedback[item.id]) {
      return false;
    }
    this.data.addedFeedback[item.id] = item;
    await this.saveData();
    return true;
  }
  /**
   * Remove feedback item from board
   */
  async removeFeedback(itemId) {
    if (!this.data.addedFeedback[itemId])
      return;
    delete this.data.addedFeedback[itemId];
    await this.saveData();
    new import_obsidian9.Notice("Feedback removed from board");
  }
  /**
   * Check if feedback is already added
   */
  isFeedbackAdded(itemId) {
    return !!this.data.addedFeedback[itemId];
  }
  /**
   * Get all added feedback items (synced with current file state)
   */
  async getAddedFeedback() {
    const items = [];
    const toRemove = [];
    for (const [itemId, item] of Object.entries(this.data.addedFeedback)) {
      const file = this.app.vault.getAbstractFileByPath(item.filePath);
      if (!(file instanceof import_obsidian9.TFile)) {
        toRemove.push(itemId);
        continue;
      }
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");
      if (item.line >= lines.length) {
        toRemove.push(itemId);
        continue;
      }
      const line = lines[item.line];
      if (!this.hasFeedbackTag(line)) {
        toRemove.push(itemId);
        continue;
      }
      const updatedItem = this.parseFeedbackFromLine(
        line,
        item.line,
        file
      );
      if (updatedItem) {
        updatedItem.addedAt = item.addedAt;
        items.push(updatedItem);
      } else {
        toRemove.push(itemId);
      }
    }
    if (toRemove.length > 0) {
      for (const id of toRemove) {
        delete this.data.addedFeedback[id];
      }
      await this.saveData();
    }
    return items;
  }
};

// src/feedbackScanner.ts
var FeedbackScanner = class {
  constructor(app, feedbackManager, settings) {
    this.app = app;
    this.feedbackManager = feedbackManager;
    this.settings = settings;
  }
  updateSettings(settings) {
    this.settings = settings;
    this.feedbackManager.updateSettings(settings);
  }
  async scanBoard() {
    await this.autoAddMarkedNotes();
    const items = await this.feedbackManager.getAddedFeedback();
    return this.buildTopicGroups(items);
  }
  async autoAddMarkedNotes() {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const isExcluded = this.settings.excludedFolders.some(
        (folder) => file.path.startsWith(folder)
      );
      if (isExcluded)
        continue;
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!this.feedbackManager.hasFeedbackTag(line))
          continue;
        const itemId = `${file.path}:${i}`;
        if (this.feedbackManager.isFeedbackAdded(itemId))
          continue;
        const item = this.feedbackManager.parseFeedbackFromLine(
          line,
          i,
          file
        );
        if (item) {
          await this.feedbackManager.addFeedbackSilently(item);
        }
      }
    }
  }
  buildTopicGroups(items) {
    const tagItemMap = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (item.tags.length === 0) {
        const untaggedKey = "#\u672A\u5206\u7C7B";
        if (!tagItemMap.has(untaggedKey)) {
          tagItemMap.set(untaggedKey, []);
        }
        tagItemMap.get(untaggedKey).push(item);
      } else {
        for (const tag of item.tags) {
          const normalizedTag = tag.toLowerCase();
          if (this.settings.excludedTags.includes(normalizedTag))
            continue;
          if (!tagItemMap.has(normalizedTag)) {
            tagItemMap.set(normalizedTag, []);
          }
          tagItemMap.get(normalizedTag).push(item);
        }
      }
    }
    const groups = [];
    for (const [tag, items2] of tagItemMap) {
      const sortedItems = this.sortItems(items2);
      groups.push({
        tag,
        displayTag: tag.replace(/^#/, ""),
        items: sortedItems,
        totalCount: sortedItems.length
      });
    }
    return this.sortTopics(groups);
  }
  sortItems(items) {
    return items.sort((a, b) => b.addedAt - a.addedAt);
  }
  sortTopics(groups) {
    if (this.settings.topicSortOrder === "taskCount") {
      return groups.sort((a, b) => b.totalCount - a.totalCount);
    }
    return groups.sort(
      (a, b) => a.displayTag.localeCompare(b.displayTag)
    );
  }
};

// src/negativeFeedbackManager.ts
var import_obsidian10 = require("obsidian");
var TAG_REGEX2 = /#[\w\-\/\u4e00-\u9fa5😒]+/g;
var NegativeFeedbackManager = class {
  constructor(app, settings, data, saveData) {
    this.app = app;
    this.settings = settings;
    this.data = data;
    this.saveData = saveData;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  updateData(data) {
    this.data = data;
  }
  /**
   * Extract all tags from text
   */
  extractTags(text) {
    const matches = text.match(TAG_REGEX2);
    return matches ? matches.map((tag) => tag.toLowerCase()) : [];
  }
  /**
   * Check if a line has the negative feedback trigger tag
   */
  hasNegativeFeedbackTag(line) {
    const tags = this.extractTags(line);
    return NEGATIVE_FEEDBACK_TRIGGER_TAGS.some(
      (triggerTag) => tags.includes(triggerTag.toLowerCase())
    );
  }
  /**
   * Check if a line is a list item (- or * prefix)
   */
  isListItem(line) {
    return /^[\s]*[-*]\s+/.test(line);
  }
  /**
   * Parse feedback item from a line
   */
  parseFeedbackFromLine(line, lineNumber, file) {
    if (!this.isListItem(line)) {
      return null;
    }
    if (!this.hasNegativeFeedbackTag(line)) {
      return null;
    }
    const allTags = this.extractTags(line);
    const topicTags = allTags.filter((tag) => {
      const isTriggerTag = NEGATIVE_FEEDBACK_TRIGGER_TAGS.some(
        (triggerTag) => tag === triggerTag.toLowerCase()
      );
      return !isTriggerTag && !this.settings.excludedTags.includes(tag);
    });
    const displayText = line.replace(/^[\s]*[-*]\s+/, "").replace(TAG_REGEX2, "").trim();
    return {
      id: `${file.path}:${lineNumber}`,
      text: displayText,
      filePath: file.path,
      fileName: file.basename,
      line: lineNumber,
      tags: topicTags,
      addedAt: Date.now()
    };
  }
  /**
   * Get feedback item at a specific line
   */
  async getFeedbackAtPosition(file, line) {
    const content = await this.app.vault.cachedRead(file);
    const lines = content.split("\n");
    if (line >= lines.length)
      return null;
    return this.parseFeedbackFromLine(lines[line], line, file);
  }
  /**
   * Add feedback item silently (no notice)
   */
  async addFeedbackSilently(item) {
    if (this.data.addedNegativeFeedback[item.id]) {
      return false;
    }
    this.data.addedNegativeFeedback[item.id] = item;
    await this.saveData();
    return true;
  }
  /**
   * Remove feedback item from board
   */
  async removeFeedback(itemId) {
    if (!this.data.addedNegativeFeedback[itemId])
      return;
    delete this.data.addedNegativeFeedback[itemId];
    await this.saveData();
    new import_obsidian10.Notice("Negative feedback removed from board");
  }
  /**
   * Check if feedback is already added
   */
  isFeedbackAdded(itemId) {
    return !!this.data.addedNegativeFeedback[itemId];
  }
  /**
   * Get all added feedback items (synced with current file state)
   */
  async getAddedFeedback() {
    const items = [];
    const toRemove = [];
    for (const [itemId, item] of Object.entries(this.data.addedNegativeFeedback)) {
      const file = this.app.vault.getAbstractFileByPath(item.filePath);
      if (!(file instanceof import_obsidian10.TFile)) {
        toRemove.push(itemId);
        continue;
      }
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");
      if (item.line >= lines.length) {
        toRemove.push(itemId);
        continue;
      }
      const line = lines[item.line];
      if (!this.hasNegativeFeedbackTag(line)) {
        toRemove.push(itemId);
        continue;
      }
      const updatedItem = this.parseFeedbackFromLine(
        line,
        item.line,
        file
      );
      if (updatedItem) {
        updatedItem.addedAt = item.addedAt;
        items.push(updatedItem);
      } else {
        toRemove.push(itemId);
      }
    }
    if (toRemove.length > 0) {
      for (const id of toRemove) {
        delete this.data.addedNegativeFeedback[id];
      }
      await this.saveData();
    }
    return items;
  }
};

// src/negativeFeedbackScanner.ts
var NegativeFeedbackScanner = class {
  constructor(app, negativeFeedbackManager, settings) {
    this.app = app;
    this.negativeFeedbackManager = negativeFeedbackManager;
    this.settings = settings;
  }
  updateSettings(settings) {
    this.settings = settings;
    this.negativeFeedbackManager.updateSettings(settings);
  }
  async scanBoard() {
    await this.autoAddMarkedNotes();
    const items = await this.negativeFeedbackManager.getAddedFeedback();
    return this.buildTopicGroups(items);
  }
  async autoAddMarkedNotes() {
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      const isExcluded = this.settings.excludedFolders.some(
        (folder) => file.path.startsWith(folder)
      );
      if (isExcluded)
        continue;
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!this.negativeFeedbackManager.hasNegativeFeedbackTag(line))
          continue;
        const itemId = `${file.path}:${i}`;
        if (this.negativeFeedbackManager.isFeedbackAdded(itemId))
          continue;
        const item = this.negativeFeedbackManager.parseFeedbackFromLine(
          line,
          i,
          file
        );
        if (item) {
          await this.negativeFeedbackManager.addFeedbackSilently(item);
        }
      }
    }
  }
  buildTopicGroups(items) {
    const tagItemMap = /* @__PURE__ */ new Map();
    for (const item of items) {
      if (item.tags.length === 0) {
        const untaggedKey = "#\u672A\u5206\u7C7B";
        if (!tagItemMap.has(untaggedKey)) {
          tagItemMap.set(untaggedKey, []);
        }
        tagItemMap.get(untaggedKey).push(item);
      } else {
        for (const tag of item.tags) {
          const normalizedTag = tag.toLowerCase();
          if (this.settings.excludedTags.includes(normalizedTag))
            continue;
          if (!tagItemMap.has(normalizedTag)) {
            tagItemMap.set(normalizedTag, []);
          }
          tagItemMap.get(normalizedTag).push(item);
        }
      }
    }
    const groups = [];
    for (const [tag, items2] of tagItemMap) {
      const sortedItems = this.sortItems(items2);
      groups.push({
        tag,
        displayTag: tag.replace(/^#/, ""),
        items: sortedItems,
        totalCount: sortedItems.length
      });
    }
    return this.sortTopics(groups);
  }
  sortItems(items) {
    return items.sort((a, b) => b.addedAt - a.addedAt);
  }
  sortTopics(groups) {
    if (this.settings.topicSortOrder === "taskCount") {
      return groups.sort((a, b) => b.totalCount - a.totalCount);
    }
    return groups.sort(
      (a, b) => a.displayTag.localeCompare(b.displayTag)
    );
  }
};

// src/northStarTypes.ts
var DEFAULT_SIGNAL_WEIGHTS = {
  goalDirectDeepWork: 0.3,
  taskCompletion: 0.15,
  reflectionDepth: 0.25,
  pipelineActivity: 0.2,
  feedbackSignals: 0.1
};
var DEFAULT_POLICY = {
  signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
  checkInPrompts: [],
  milestones: [],
  version: 1
};
var DEFAULT_NORTHSTAR_DATA = {
  goal: null,
  policy: { ...DEFAULT_POLICY, signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS }, milestones: [] },
  assessments: [],
  archivedGoals: [],
  tinkerMessages: []
};
var TIME_ANNOTATION_REGEX = /@(\d{1,2}(?::?\d{2})?)\s*(?:AM|PM|am|pm)?\s*[-–]\s*(\d{1,2}(?::?\d{2})?)\s*(?:AM|PM|am|pm)?/;

// src/northStarManager.ts
var NorthStarManager = class {
  constructor(app, settings, data, saveData) {
    this.app = app;
    this.settings = settings;
    this.data = data;
    this.saveData = saveData;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  updateData(data) {
    this.data = data;
  }
  getGoal() {
    return this.data.goal;
  }
  getPolicy() {
    return this.data.policy;
  }
  getAssessments() {
    return this.data.assessments;
  }
  getLatestAssessment() {
    if (this.data.assessments.length === 0)
      return null;
    return this.data.assessments[this.data.assessments.length - 1];
  }
  getDayNumber() {
    const goal = this.data.goal;
    if (!goal)
      return 0;
    const lockedDate = new Date(goal.lockedAt);
    lockedDate.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffMs = now.getTime() - lockedDate.getTime();
    return Math.floor(diffMs / (1e3 * 60 * 60 * 24)) + 1;
  }
  getDaysLeft() {
    const goal = this.data.goal;
    if (!goal)
      return 0;
    return Math.max(0, goal.timeWindowDays - this.getDayNumber() + 1);
  }
  async setGoal(text, timeWindowDays) {
    if (this.data.goal) {
      this.data.goal.active = false;
      this.data.archivedGoals.push(this.data.goal);
    }
    const goal = {
      id: `ns-${Date.now()}`,
      text,
      timeWindowDays,
      lockedAt: Date.now(),
      currentPhase: "exploration",
      active: true
    };
    this.data.goal = goal;
    this.data.policy = {
      signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
      checkInPrompts: [],
      milestones: [],
      version: 1
    };
    this.data.assessments = [];
    this.data.tinkerMessages = [];
    await this.saveData();
    return goal;
  }
  async addAssessment(assessment) {
    const existingIndex = this.data.assessments.findIndex(
      (a) => a.date === assessment.date
    );
    if (existingIndex >= 0) {
      this.data.assessments[existingIndex] = assessment;
    } else {
      this.data.assessments.push(assessment);
    }
    await this.saveData();
  }
  async archiveGoal() {
    if (!this.data.goal)
      return;
    this.data.goal.active = false;
    this.data.archivedGoals.push(this.data.goal);
    this.data.goal = null;
    this.data.assessments = [];
    this.data.tinkerMessages = [];
    this.data.policy = { ...DEFAULT_POLICY, signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS }, milestones: [] };
    await this.saveData();
  }
  getTinkerMessages() {
    return this.data.tinkerMessages;
  }
  async addTinkerMessage(msg) {
    this.data.tinkerMessages.push(msg);
    await this.saveData();
  }
  async clearTinkerMessages() {
    this.data.tinkerMessages = [];
    await this.saveData();
  }
};

// src/northStarLlmClient.ts
var import_obsidian11 = require("obsidian");
var NorthStarLlmClient = class {
  constructor(settings) {
    this.settings = settings;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  async chat(systemPrompt, messages) {
    const apiKey = this.settings.anthropicApiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key not set. Go to Settings \u2192 Acta Task \u2192 North Star to add it.");
    }
    let response;
    try {
      response = await (0, import_obsidian11.requestUrl)({
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this.settings.northStarModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content }))
        }),
        throw: false
      });
    } catch (e) {
      throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (response.status === 401) {
      throw new Error("Invalid API key. Check your key in Settings \u2192 Acta Task \u2192 North Star.");
    }
    if (response.status !== 200) {
      throw new Error(`API error (${response.status}): ${response.text}`);
    }
    const data = response.json;
    if (data.content && data.content.length > 0 && data.content[0].type === "text") {
      return data.content[0].text;
    }
    throw new Error("Unexpected API response format");
  }
  async chatWithTools(systemPrompt, messages, tools) {
    const apiKey = this.settings.anthropicApiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key not set. Go to Settings \u2192 Acta Task \u2192 North Star to add it.");
    }
    let response;
    try {
      response = await (0, import_obsidian11.requestUrl)({
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this.settings.northStarModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          tools
        }),
        throw: false
      });
    } catch (e) {
      throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (response.status === 401) {
      throw new Error("Invalid API key. Check your key in Settings \u2192 Acta Task \u2192 North Star.");
    }
    if (response.status !== 200) {
      throw new Error(`API error (${response.status}): ${response.text}`);
    }
    const data = response.json;
    return {
      content: data.content || [],
      stop_reason: data.stop_reason || "end_turn"
    };
  }
  async call(systemPrompt, userMessage) {
    const apiKey = this.settings.anthropicApiKey;
    if (!apiKey) {
      throw new Error("Anthropic API key not set. Go to Settings \u2192 Acta Task \u2192 North Star to add it.");
    }
    let response;
    try {
      response = await (0, import_obsidian11.requestUrl)({
        url: "https://api.anthropic.com/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: this.settings.northStarModel,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }]
        }),
        throw: false
      });
    } catch (e) {
      throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (response.status === 401) {
      throw new Error("Invalid API key. Check your key in Settings \u2192 Acta Task \u2192 North Star.");
    }
    if (response.status !== 200) {
      throw new Error(`API error (${response.status}): ${response.text}`);
    }
    const data = response.json;
    if (data.content && data.content.length > 0 && data.content[0].type === "text") {
      return data.content[0].text;
    }
    throw new Error("Unexpected API response format");
  }
};

// src/northStarObserver.ts
var NorthStarObserver = class {
  constructor(app, settings, taskData, feedbackData, negativeFeedbackData) {
    this.app = app;
    this.settings = settings;
    this.taskData = taskData;
    this.feedbackData = feedbackData;
    this.negativeFeedbackData = negativeFeedbackData;
  }
  updateSettings(settings) {
    this.settings = settings;
  }
  updateData(taskData, feedbackData, negativeFeedbackData) {
    this.taskData = taskData;
    this.feedbackData = feedbackData;
    this.negativeFeedbackData = negativeFeedbackData;
  }
  async observe(dateStr, onStep) {
    onStep == null ? void 0 : onStep("tasks", "Scanning task board...");
    const tasks = this.extractTaskSignals(dateStr);
    const completedCount = tasks.filter((t) => t.completed).length;
    const deepWorkCount = tasks.filter((t) => t.effort === "deep_work").length;
    onStep == null ? void 0 : onStep("tasks", `Found ${tasks.length} tasks (${completedCount} completed, ${deepWorkCount} deep work)`);
    onStep == null ? void 0 : onStep("positive-feedback", "Scanning positive feedback...");
    const positiveFeedback = this.extractPositiveFeedbackSignals(dateStr);
    onStep == null ? void 0 : onStep("positive-feedback", `Found ${positiveFeedback.length} positive feedback entries`);
    onStep == null ? void 0 : onStep("negative-feedback", "Scanning negative feedback...");
    const negativeFeedback = this.extractNegativeFeedbackSignals(dateStr);
    onStep == null ? void 0 : onStep("negative-feedback", `Found ${negativeFeedback.length} negative feedback entries`);
    const feedback = [...positiveFeedback, ...negativeFeedback];
    onStep == null ? void 0 : onStep("reflections", "Scanning #northstar reflections...");
    const reflections = await this.extractReflections(dateStr);
    onStep == null ? void 0 : onStep("reflections", `Found ${reflections.length} reflections`);
    onStep == null ? void 0 : onStep("vault", "Checking vault activity...");
    const vaultActivity = this.getVaultActivity(dateStr);
    onStep == null ? void 0 : onStep("vault", `${vaultActivity.filesModified} files across ${vaultActivity.foldersActive.length} folders`);
    return {
      date: dateStr,
      tasks,
      feedback,
      reflections,
      vaultActivity
    };
  }
  extractTaskSignals(dateStr) {
    const signals = [];
    const compactDate = dateStr.replace(/-/g, "");
    for (const task of Object.values(this.taskData.addedTasks)) {
      if (!task.filePath.includes(compactDate))
        continue;
      const timeMatch = task.text.match(TIME_ANNOTATION_REGEX);
      let durationMin;
      let timeAnnotation;
      if (timeMatch) {
        timeAnnotation = timeMatch[0];
        durationMin = this.parseDuration(timeMatch[1], timeMatch[2]);
      }
      signals.push({
        title: task.text,
        tags: task.tags,
        completed: task.completed,
        timeAnnotation,
        durationMin,
        effort: timeMatch ? "deep_work" : "quick_action"
      });
    }
    return signals;
  }
  parseDuration(startStr, endStr) {
    const startHour = this.parseHour(startStr);
    const endHour = this.parseHour(endStr);
    let diff = endHour - startHour;
    if (diff <= 0)
      diff += 12;
    return Math.round(diff * 60);
  }
  parseHour(timeStr) {
    const cleaned = timeStr.replace(":", "");
    if (cleaned.length <= 2) {
      return parseInt(cleaned, 10);
    }
    const hours = parseInt(cleaned.slice(0, -2), 10);
    const minutes = parseInt(cleaned.slice(-2), 10);
    return hours + minutes / 60;
  }
  extractPositiveFeedbackSignals(dateStr) {
    const signals = [];
    const compactDate = dateStr.replace(/-/g, "");
    for (const item of Object.values(this.feedbackData.addedFeedback)) {
      if (!item.filePath.includes(compactDate))
        continue;
      signals.push({
        text: item.text,
        tags: item.tags,
        type: "positive"
      });
    }
    return signals;
  }
  extractNegativeFeedbackSignals(dateStr) {
    const signals = [];
    const compactDate = dateStr.replace(/-/g, "");
    for (const item of Object.values(this.negativeFeedbackData.addedNegativeFeedback)) {
      if (!item.filePath.includes(compactDate))
        continue;
      signals.push({
        text: item.text,
        tags: item.tags,
        type: "negative"
      });
    }
    return signals;
  }
  async extractReflections(dateStr) {
    const reflections = [];
    const compactDate = dateStr.replace(/-/g, "");
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (!file.path.includes(compactDate))
        continue;
      const content = await this.app.vault.cachedRead(file);
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.toLowerCase().includes("#northstar")) {
          const cleanText = line.replace(/^[\s]*[-*]\s+/, "").replace(/#northstar/gi, "").trim();
          if (cleanText.length > 0) {
            reflections.push({
              text: cleanText,
              filePath: file.path
            });
          }
        }
      }
    }
    return reflections;
  }
  getVaultActivity(dateStr) {
    var _a;
    const compactDate = dateStr.replace(/-/g, "");
    const files = this.app.vault.getMarkdownFiles();
    let filesModified = 0;
    const foldersSet = /* @__PURE__ */ new Set();
    for (const file of files) {
      if (file.path.includes(compactDate)) {
        filesModified++;
        const folder = ((_a = file.parent) == null ? void 0 : _a.path) || "/";
        foldersSet.add(folder);
      }
    }
    return {
      filesModified,
      foldersActive: Array.from(foldersSet)
    };
  }
};

// src/northStarAgent.ts
var NorthStarAgent = class {
  constructor(manager, observer, llmClient) {
    this.manager = manager;
    this.observer = observer;
    this.llmClient = llmClient;
  }
  async observeSignals(dateStr, onProgress) {
    return this.observer.observe(dateStr, (step, detail) => {
      const isRunning = detail.startsWith("Scanning") || detail.startsWith("Checking");
      onProgress == null ? void 0 : onProgress(step, isRunning ? "running" : "done", detail);
    });
  }
  async assessSignals(dateStr, signals) {
    const goal = this.manager.getGoal();
    if (!goal)
      throw new Error("No active goal set");
    const policy = this.manager.getPolicy();
    const dayNumber = this.manager.getDayNumber();
    const assessment = await this.assess(goal, signals, policy, dayNumber, dateStr);
    await this.manager.addAssessment(assessment);
    return assessment;
  }
  async runCycle(dateStr, onProgress) {
    const goal = this.manager.getGoal();
    if (!goal) {
      throw new Error("No active goal set");
    }
    const policy = this.manager.getPolicy();
    const dayNumber = this.manager.getDayNumber();
    const signals = await this.observer.observe(dateStr, (step, detail) => {
      const isRunning = detail.startsWith("Scanning") || detail.startsWith("Checking");
      onProgress == null ? void 0 : onProgress(step, isRunning ? "running" : "done", detail);
    });
    onProgress == null ? void 0 : onProgress("assess", "running", "Sending signals to Claude for assessment...");
    const assessment = await this.assess(goal, signals, policy, dayNumber, dateStr);
    onProgress == null ? void 0 : onProgress("assess", "done", `Assessment complete \u2014 score: ${assessment.overallScore}/100`);
    onProgress == null ? void 0 : onProgress("save", "running", "Saving assessment...");
    await this.manager.addAssessment(assessment);
    onProgress == null ? void 0 : onProgress("save", "done", "Assessment saved to data.json");
    return assessment;
  }
  async assess(goal, signals, policy, dayNumber, dateStr) {
    const systemPrompt = this.buildAssessSystemPrompt();
    const userMessage = this.buildAssessUserMessage(goal, signals, policy, dayNumber);
    const rawResponse = await this.llmClient.call(systemPrompt, userMessage);
    return this.parseAssessResponse(rawResponse, dateStr, dayNumber, signals, policy.version);
  }
  buildAssessSystemPrompt() {
    return `You are an alignment assessment agent for a personal goal-tracking system called North Star.

Your job: Given a user's locked goal, today's activity signals, and the current measurement policy (signal weights), produce a structured assessment of how aligned today's work was with the goal.

You MUST respond with valid JSON only \u2014 no markdown, no explanation outside the JSON. The JSON must match this schema:

{
  "overallScore": <number 0-100>,
  "signalBreakdown": [
    {
      "category": "<string: goalDirectDeepWork | taskCompletion | reflectionDepth | pipelineActivity | feedbackSignals>",
      "weight": <number: the weight from the policy>,
      "score": <number: points earned>,
      "maxScore": <number: max possible points for this category = weight * 100>,
      "reasoning": "<string: 1-2 sentence explanation>"
    }
  ],
  "driftIndicators": ["<string: specific observation of misalignment>"],
  "momentumIndicators": ["<string: specific observation of progress>"]
}

Rules:
- overallScore = sum of all signalBreakdown scores
- Each category's maxScore = weight * 100
- Be specific in reasoning \u2014 reference actual task names, feedback entries, and reflections
- Drift indicators should cite concrete evidence of misalignment
- Momentum indicators should cite concrete evidence of progress
- If signals are empty for a category, score it low but explain why
- Be honest and calibrated \u2014 don't inflate scores`;
  }
  buildAssessUserMessage(goal, signals, policy, dayNumber) {
    return `## Locked Goal
"${goal.text}"
Time window: ${goal.timeWindowDays} days
Current phase: ${goal.currentPhase}
Day: ${dayNumber} of ${goal.timeWindowDays}

## Measurement Policy (v${policy.version})
Signal weights:
- goalDirectDeepWork: ${policy.signalWeights.goalDirectDeepWork}
- taskCompletion: ${policy.signalWeights.taskCompletion}
- reflectionDepth: ${policy.signalWeights.reflectionDepth}
- pipelineActivity: ${policy.signalWeights.pipelineActivity}
- feedbackSignals: ${policy.signalWeights.feedbackSignals}

${policy.milestones.length > 0 ? `Milestones:
${policy.milestones.map((m) => `- ${m.text} (deadline: ${m.deadline}, completed: ${m.completed})`).join("\n")}` : "No milestones set yet."}

## Today's Signals (${signals.date})

### Tasks (${signals.tasks.length})
${signals.tasks.length > 0 ? signals.tasks.map((t) => `- [${t.completed ? "x" : " "}] ${t.title} ${t.tags.join(" ")} | effort: ${t.effort}${t.timeAnnotation ? ` | time: ${t.timeAnnotation} (${t.durationMin}min)` : ""}`).join("\n") : "No tasks recorded today."}

### Feedback (${signals.feedback.length})
${signals.feedback.length > 0 ? signals.feedback.map((f) => `- [${f.type}] ${f.text} ${f.tags.join(" ")}`).join("\n") : "No feedback entries today."}

### Reflections (${signals.reflections.length})
${signals.reflections.length > 0 ? signals.reflections.map((r) => `- ${r.text}`).join("\n") : "No #northstar reflections today."}

### Vault Activity
- Files modified: ${signals.vaultActivity.filesModified}
- Active folders: ${signals.vaultActivity.foldersActive.join(", ") || "none"}

Produce the assessment JSON now.`;
  }
  parseAssessResponse(raw, dateStr, dayNumber, signals, policyVersion) {
    let jsonStr = raw.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    const parsed = JSON.parse(jsonStr);
    return {
      id: `assess-${dateStr}-${Date.now()}`,
      date: dateStr,
      dayNumber,
      overallScore: Math.max(0, Math.min(100, parsed.overallScore || 0)),
      signalBreakdown: (parsed.signalBreakdown || []).map((s) => ({
        category: s.category,
        weight: s.weight,
        score: s.score,
        maxScore: s.maxScore,
        reasoning: s.reasoning
      })),
      driftIndicators: parsed.driftIndicators || [],
      momentumIndicators: parsed.momentumIndicators || [],
      rawSignals: signals,
      policyVersion
    };
  }
};

// src/main.ts
var ActaTaskPlugin = class extends import_obsidian12.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.data = DEFAULT_DATA;
    this.feedbackData = DEFAULT_FEEDBACK_DATA;
    this.negativeFeedbackData = DEFAULT_NEGATIVE_FEEDBACK_DATA;
    this.northStarData = { ...DEFAULT_NORTHSTAR_DATA };
    this.taskManager = null;
    this.scanner = null;
    this.toggler = null;
    this.feedbackManager = null;
    this.feedbackScanner = null;
    this.negativeFeedbackManager = null;
    this.negativeFeedbackScanner = null;
    this.northStarManager = null;
    this.northStarLlmClient = null;
    this.northStarObserver = null;
    this.northStarAgent = null;
  }
  async onload() {
    await this.loadSettings();
    await this.loadTaskData();
    await this.loadFeedbackData();
    await this.loadNegativeFeedbackData();
    await this.loadNorthStarData();
    this.taskManager = new TaskManager(
      this.app,
      this.settings,
      this.data,
      () => this.saveTaskData()
    );
    this.scanner = new TaskScanner(this.app, this.taskManager, this.settings);
    this.toggler = new TaskToggler(this.app);
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
    this.registerView(ACTA_TASK_VIEW_TYPE, (leaf) => {
      return new TaskBoardView(
        leaf,
        this.scanner,
        this.toggler,
        this.taskManager,
        this.settings
      );
    });
    this.registerView(ACTA_FEEDBACK_VIEW_TYPE, (leaf) => {
      return new FeedbackBoardView(
        leaf,
        this.feedbackScanner,
        this.feedbackManager,
        this.settings
      );
    });
    this.registerView(ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE, (leaf) => {
      return new NegativeFeedbackBoardView(
        leaf,
        this.negativeFeedbackScanner,
        this.negativeFeedbackManager,
        this.settings
      );
    });
    this.registerView(ACTA_NORTHSTAR_VIEW_TYPE, (leaf) => {
      return new NorthStarBoardView(
        leaf,
        this.northStarManager,
        this.northStarAgent,
        this.northStarLlmClient,
        this.settings
      );
    });
    this.addRibbonIcon("list-checks", "Open Acta Task Board", () => {
      this.openBoard();
    });
    this.addCommand({
      id: "open-acta-task-board",
      name: "Open task board",
      callback: () => this.openBoard()
    });
    this.addCommand({
      id: "refresh-acta-task-board",
      name: "Refresh task board",
      callback: () => this.refreshBoard()
    });
    this.addRibbonIcon("heart", "Open \u2764\uFE0F \u6B63\u53CD\u9988board", () => {
      this.openFeedbackBoard();
    });
    this.addCommand({
      id: "open-acta-feedback-board",
      name: "Open \u2764\uFE0F \u6B63\u53CD\u9988board",
      callback: () => this.openFeedbackBoard()
    });
    this.addCommand({
      id: "refresh-acta-feedback-board",
      name: "Refresh \u2764\uFE0F \u6B63\u53CD\u9988board",
      callback: () => this.refreshFeedbackBoard()
    });
    this.addRibbonIcon("frown", "Open \u{1F612} \u8D1F\u53CD\u9988board", () => {
      this.openNegativeFeedbackBoard();
    });
    this.addCommand({
      id: "open-acta-negative-feedback-board",
      name: "Open \u{1F612} \u8D1F\u53CD\u9988board",
      callback: () => this.openNegativeFeedbackBoard()
    });
    this.addCommand({
      id: "refresh-acta-negative-feedback-board",
      name: "Refresh \u{1F612} \u8D1F\u53CD\u9988board",
      callback: () => this.refreshNegativeFeedbackBoard()
    });
    this.addRibbonIcon("star", "Open North Star board", () => {
      this.openNorthStarBoard();
    });
    this.addCommand({
      id: "open-acta-northstar-board",
      name: "Open North Star board",
      callback: () => this.openNorthStarBoard()
    });
    this.addCommand({
      id: "refresh-acta-northstar-board",
      name: "Refresh North Star board",
      callback: () => this.refreshNorthStarBoard()
    });
    this.addSettingTab(new ActaTaskSettingTab(this.app, this));
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(ACTA_TASK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ACTA_FEEDBACK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ACTA_NORTHSTAR_VIEW_TYPE);
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data == null ? void 0 : data.settings);
  }
  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      tasks: this.data,
      feedback: this.feedbackData,
      negativeFeedback: this.negativeFeedbackData,
      northStar: this.northStarData
    });
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
    if (northStarView)
      northStarView.updateSettings(this.settings);
    const taskView = this.getActiveTaskView();
    if (taskView)
      taskView.updateSettings(this.settings);
    const feedbackView = this.getActiveFeedbackView();
    if (feedbackView)
      feedbackView.updateSettings(this.settings);
    const negativeFeedbackView = this.getActiveNegativeFeedbackView();
    if (negativeFeedbackView)
      negativeFeedbackView.updateSettings(this.settings);
    this.app.workspace.updateOptions();
  }
  async loadTaskData() {
    const data = await this.loadData();
    this.data = Object.assign({}, DEFAULT_DATA, data == null ? void 0 : data.tasks);
  }
  async saveTaskData() {
    await this.saveData({
      settings: this.settings,
      tasks: this.data,
      feedback: this.feedbackData,
      negativeFeedback: this.negativeFeedbackData,
      northStar: this.northStarData
    });
  }
  async loadFeedbackData() {
    const data = await this.loadData();
    this.feedbackData = Object.assign(
      {},
      DEFAULT_FEEDBACK_DATA,
      data == null ? void 0 : data.feedback
    );
  }
  async saveFeedbackData() {
    await this.saveData({
      settings: this.settings,
      tasks: this.data,
      feedback: this.feedbackData,
      negativeFeedback: this.negativeFeedbackData,
      northStar: this.northStarData
    });
  }
  async loadNegativeFeedbackData() {
    const data = await this.loadData();
    this.negativeFeedbackData = Object.assign(
      {},
      DEFAULT_NEGATIVE_FEEDBACK_DATA,
      data == null ? void 0 : data.negativeFeedback
    );
  }
  async saveNegativeFeedbackData() {
    await this.saveData({
      settings: this.settings,
      tasks: this.data,
      feedback: this.feedbackData,
      negativeFeedback: this.negativeFeedbackData,
      northStar: this.northStarData
    });
  }
  async loadNorthStarData() {
    const data = await this.loadData();
    this.northStarData = Object.assign(
      {},
      DEFAULT_NORTHSTAR_DATA,
      data == null ? void 0 : data.northStar
    );
    if (!this.northStarData.policy) {
      this.northStarData.policy = { ...DEFAULT_NORTHSTAR_DATA.policy };
    }
    if (!this.northStarData.assessments) {
      this.northStarData.assessments = [];
    }
    if (!this.northStarData.archivedGoals) {
      this.northStarData.archivedGoals = [];
    }
    if (!this.northStarData.tinkerMessages) {
      this.northStarData.tinkerMessages = [];
    }
  }
  async saveNorthStarData() {
    await this.saveData({
      settings: this.settings,
      tasks: this.data,
      feedback: this.feedbackData,
      negativeFeedback: this.negativeFeedbackData,
      northStar: this.northStarData
    });
  }
  getActiveTaskView() {
    const leaves = this.app.workspace.getLeavesOfType(
      ACTA_TASK_VIEW_TYPE
    );
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  getActiveFeedbackView() {
    const leaves = this.app.workspace.getLeavesOfType(
      ACTA_FEEDBACK_VIEW_TYPE
    );
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  getActiveNegativeFeedbackView() {
    const leaves = this.app.workspace.getLeavesOfType(
      ACTA_NEGATIVE_FEEDBACK_VIEW_TYPE
    );
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  refreshBoard() {
    const view = this.getActiveTaskView();
    if (view)
      view.refresh();
  }
  refreshFeedbackBoard() {
    const view = this.getActiveFeedbackView();
    if (view)
      view.refresh();
  }
  refreshNegativeFeedbackBoard() {
    const view = this.getActiveNegativeFeedbackView();
    if (view)
      view.refresh();
  }
  async openBoard() {
    const existing = this.app.workspace.getLeavesOfType(ACTA_TASK_VIEW_TYPE);
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({
        type: ACTA_TASK_VIEW_TYPE,
        active: true
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  async openFeedbackBoard() {
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
        active: true
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  async openNegativeFeedbackBoard() {
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
        active: true
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }
  getActiveNorthStarView() {
    const leaves = this.app.workspace.getLeavesOfType(
      ACTA_NORTHSTAR_VIEW_TYPE
    );
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  refreshNorthStarBoard() {
    const view = this.getActiveNorthStarView();
    if (view)
      view.refresh();
  }
  async openNorthStarBoard() {
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
        active: true
      });
      this.app.workspace.revealLeaf(leaf);
    }
  }
};
