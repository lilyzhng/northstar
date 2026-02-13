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
var import_obsidian5 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  excludedTags: [],
  excludedFolders: [".obsidian"],
  showCompleted: true,
  showSourceNote: true,
  topicSortOrder: "alphabetical",
  taskSortOrder: "incompleteFirst"
};
var DEFAULT_DATA = {
  addedTasks: {}
};
var ACTA_TASK_VIEW_TYPE = "acta-task-board";

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

// src/settings.ts
var import_obsidian2 = require("obsidian");
var ActaTaskSettingTab = class extends import_obsidian2.PluginSettingTab {
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
    new import_obsidian2.Setting(containerEl).setName("Excluded tags").setDesc(
      "Comma-separated list of tags to exclude (e.g. #daily, #template)"
    ).addText(
      (text) => text.setPlaceholder("#daily, #template").setValue(this.plugin.settings.excludedTags.join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedTags = value.split(",").map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0).map((t) => t.startsWith("#") ? t : "#" + t);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Excluded folders").setDesc(
      "Comma-separated list of folders to exclude (e.g. templates, archive)"
    ).addText(
      (text) => text.setPlaceholder("templates, archive").setValue(this.plugin.settings.excludedFolders.join(", ")).onChange(async (value) => {
        this.plugin.settings.excludedFolders = value.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Show completed tasks").setDesc("Display completed tasks in the board").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showCompleted).onChange(async (value) => {
        this.plugin.settings.showCompleted = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Show source note").setDesc("Display the source note name next to each task").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showSourceNote).onChange(async (value) => {
        this.plugin.settings.showSourceNote = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Topic sort order").setDesc("How to sort topic sections").addDropdown(
      (dropdown) => dropdown.addOption("alphabetical", "Alphabetical").addOption("taskCount", "Task count (most first)").setValue(this.plugin.settings.topicSortOrder).onChange(async (value) => {
        this.plugin.settings.topicSortOrder = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian2.Setting(containerEl).setName("Task sort order").setDesc("How to sort tasks within a topic").addDropdown(
      (dropdown) => dropdown.addOption("incompleteFirst", "Incomplete first").addOption("byFile", "By file").setValue(this.plugin.settings.taskSortOrder).onChange(async (value) => {
        this.plugin.settings.taskSortOrder = value;
        await this.plugin.saveSettings();
      })
    );
  }
};

// src/taskManager.ts
var import_obsidian3 = require("obsidian");
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
      new import_obsidian3.Notice("Task is already on the board");
      return false;
    }
    this.data.addedTasks[task.id] = task;
    await this.saveData();
    new import_obsidian3.Notice("Task added to board");
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
    new import_obsidian3.Notice("Task removed from board");
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
      if (!(file instanceof import_obsidian3.TFile)) {
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
var import_obsidian4 = require("obsidian");
var CHECKBOX_REGEX = /^([\s]*[-*]\s+\[)([ xX])(\]\s*.*)/;
var TaskToggler = class {
  constructor(app) {
    this.app = app;
  }
  async toggleTask(task) {
    const file = this.app.vault.getAbstractFileByPath(task.filePath);
    if (!(file instanceof import_obsidian4.TFile))
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

// src/main.ts
var ActaTaskPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
    this.data = DEFAULT_DATA;
    this.taskManager = null;
    this.scanner = null;
    this.toggler = null;
  }
  async onload() {
    await this.loadSettings();
    await this.loadTaskData();
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
        this.scanner,
        this.toggler,
        this.taskManager,
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
    this.addSettingTab(new ActaTaskSettingTab(this.app, this));
  }
  async onunload() {
    this.app.workspace.detachLeavesOfType(ACTA_TASK_VIEW_TYPE);
  }
  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data == null ? void 0 : data.settings);
  }
  async saveSettings() {
    await this.saveData({ settings: this.settings, tasks: this.data });
    if (this.taskManager) {
      this.taskManager.updateSettings(this.settings);
    }
    if (this.scanner) {
      this.scanner.updateSettings(this.settings);
    }
    const view = this.getActiveView();
    if (view)
      view.updateSettings(this.settings);
    this.app.workspace.updateOptions();
  }
  async loadTaskData() {
    const data = await this.loadData();
    this.data = Object.assign({}, DEFAULT_DATA, data == null ? void 0 : data.tasks);
  }
  async saveTaskData() {
    await this.saveData({ settings: this.settings, tasks: this.data });
  }
  getActiveView() {
    const leaves = this.app.workspace.getLeavesOfType(
      ACTA_TASK_VIEW_TYPE
    );
    if (leaves.length > 0) {
      return leaves[0].view;
    }
    return null;
  }
  refreshBoard() {
    const view = this.getActiveView();
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
};
