import { FeedbackItem, FeedbackGroup, ActaTaskSettings } from "./types";
import { NegativeFeedbackManager } from "./negativeFeedbackManager";
import { App } from "obsidian";

export class NegativeFeedbackScanner {
	constructor(
		private app: App,
		private negativeFeedbackManager: NegativeFeedbackManager,
		private settings: ActaTaskSettings
	) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
		this.negativeFeedbackManager.updateSettings(settings);
	}

	async scanBoard(): Promise<FeedbackGroup[]> {
		// Auto-add any notes with feedback tag that aren't already tracked
		await this.autoAddMarkedNotes();

		const items = await this.negativeFeedbackManager.getAddedFeedback();
		return this.buildTopicGroups(items);
	}

	private async autoAddMarkedNotes(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles();

		for (const file of files) {
			// Skip excluded folders
			const isExcluded = this.settings.excludedFolders.some((folder) =>
				file.path.startsWith(folder)
			);
			if (isExcluded) continue;

			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");

			// Scan each line for feedback tag
			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				if (!this.negativeFeedbackManager.hasNegativeFeedbackTag(line)) continue;

				const itemId = `${file.path}:${i}`;
				if (this.negativeFeedbackManager.isFeedbackAdded(itemId)) continue;

				// Auto-add this feedback
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

	private buildTopicGroups(items: FeedbackItem[]): FeedbackGroup[] {
		const tagItemMap = new Map<string, FeedbackItem[]>();

		for (const item of items) {
			// If the item has no topic tags, put it in an "未分类" group
			if (item.tags.length === 0) {
				const untaggedKey = "#未分类";
				if (!tagItemMap.has(untaggedKey)) {
					tagItemMap.set(untaggedKey, []);
				}
				tagItemMap.get(untaggedKey)!.push(item);
			} else {
				// Associate item with all its topic tags
				for (const tag of item.tags) {
					const normalizedTag = tag.toLowerCase();
					if (this.settings.excludedTags.includes(normalizedTag)) continue;

					if (!tagItemMap.has(normalizedTag)) {
						tagItemMap.set(normalizedTag, []);
					}
					tagItemMap.get(normalizedTag)!.push(item);
				}
			}
		}

		const groups: FeedbackGroup[] = [];

		for (const [tag, items] of tagItemMap) {
			const sortedItems = this.sortItems(items);

			groups.push({
				tag,
				displayTag: tag.replace(/^#/, ""),
				items: sortedItems,
				totalCount: sortedItems.length,
			});
		}

		return this.sortTopics(groups);
	}

	private sortItems(items: FeedbackItem[]): FeedbackItem[] {
		// Sort by addedAt timestamp (newest first)
		return items.sort((a, b) => b.addedAt - a.addedAt);
	}

	private sortTopics(groups: FeedbackGroup[]): FeedbackGroup[] {
		if (this.settings.topicSortOrder === "taskCount") {
			return groups.sort((a, b) => b.totalCount - a.totalCount);
		}
		// alphabetical
		return groups.sort((a, b) =>
			a.displayTag.localeCompare(b.displayTag)
		);
	}
}
