import { App, PluginSettingTab, Setting } from "obsidian";
import type ActaTaskPlugin from "./main";

export class ActaTaskSettingTab extends PluginSettingTab {
	plugin: ActaTaskPlugin;

	constructor(app: App, plugin: ActaTaskPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: "Acta Task Settings" });

		containerEl.createEl("p", {
			text: "Tasks with inline hashtags (e.g. - [ ] #people do something) are automatically tracked on the board.",
			cls: "setting-item-description",
		});

		new Setting(containerEl)
			.setName("Excluded tags")
			.setDesc(
				"Comma-separated list of tags to exclude (e.g. #daily, #template)"
			)
			.addText((text) =>
				text
					.setPlaceholder("#daily, #template")
					.setValue(this.plugin.settings.excludedTags.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.excludedTags = value
							.split(",")
							.map((t) => t.trim().toLowerCase())
							.filter((t) => t.length > 0)
							.map((t) => (t.startsWith("#") ? t : "#" + t));
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Excluded folders")
			.setDesc(
				"Comma-separated list of folders to exclude (e.g. templates, archive)"
			)
			.addText((text) =>
				text
					.setPlaceholder("templates, archive")
					.setValue(this.plugin.settings.excludedFolders.join(", "))
					.onChange(async (value) => {
						this.plugin.settings.excludedFolders = value
							.split(",")
							.map((f) => f.trim())
							.filter((f) => f.length > 0);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show completed tasks")
			.setDesc("Display completed tasks in the board")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showCompleted)
					.onChange(async (value) => {
						this.plugin.settings.showCompleted = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Show source note")
			.setDesc("Display the source note name next to each task")
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.showSourceNote)
					.onChange(async (value) => {
						this.plugin.settings.showSourceNote = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Topic sort order")
			.setDesc("How to sort topic sections")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("alphabetical", "Alphabetical")
					.addOption("taskCount", "Task count (most first)")
					.setValue(this.plugin.settings.topicSortOrder)
					.onChange(async (value) => {
						this.plugin.settings.topicSortOrder = value as
							| "alphabetical"
							| "taskCount";
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Task sort order")
			.setDesc("How to sort tasks within a topic")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("incompleteFirst", "Incomplete first")
					.addOption("byFile", "By file")
					.setValue(this.plugin.settings.taskSortOrder)
					.onChange(async (value) => {
						this.plugin.settings.taskSortOrder = value as
							| "byFile"
							| "incompleteFirst";
						await this.plugin.saveSettings();
					})
			);
	}
}
