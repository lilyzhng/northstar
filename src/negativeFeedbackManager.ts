import { App, Notice, TFile } from "obsidian";
import { FeedbackItem, ActaTaskSettings, ActaNegativeFeedbackData, NEGATIVE_FEEDBACK_TRIGGER_TAGS } from "./types";

const TAG_REGEX = /#[\w\-\/\u4e00-\u9fa5😒]+/g;

export class NegativeFeedbackManager {
	constructor(
		private app: App,
		private settings: ActaTaskSettings,
		private data: ActaNegativeFeedbackData,
		private saveData: () => Promise<void>
	) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	updateData(data: ActaNegativeFeedbackData): void {
		this.data = data;
	}

	/**
	 * Extract all tags from text
	 */
	extractTags(text: string): string[] {
		const matches = text.match(TAG_REGEX);
		return matches ? matches.map((tag) => tag.toLowerCase()) : [];
	}

	/**
	 * Check if a line has the negative feedback trigger tag
	 */
	hasNegativeFeedbackTag(line: string): boolean {
		const tags = this.extractTags(line);
		return NEGATIVE_FEEDBACK_TRIGGER_TAGS.some((triggerTag) =>
			tags.includes(triggerTag.toLowerCase())
		);
	}

	/**
	 * Check if a line is a task checkbox line
	 */
	isTaskLine(line: string): boolean {
		return /^[\s]*[-*]\s+\[[ xX]\]\s+/.test(line);
	}

	/**
	 * Parse feedback item from a line
	 */
	parseFeedbackFromLine(
		line: string,
		lineNumber: number,
		file: TFile
	): FeedbackItem | null {
		// Skip task lines
		if (this.isTaskLine(line)) {
			return null;
		}

		// Check if line has trigger tag
		if (!this.hasNegativeFeedbackTag(line)) {
			return null;
		}

		// Extract all tags from the line
		const allTags = this.extractTags(line);

		// Filter to get only topic tags (exclude trigger tags and excluded tags)
		const topicTags = allTags.filter((tag) => {
			const isTriggerTag = NEGATIVE_FEEDBACK_TRIGGER_TAGS.some(
				(triggerTag) => tag === triggerTag.toLowerCase()
			);
			return (
				!isTriggerTag &&
				!this.settings.excludedTags.includes(tag)
			);
		});

		// Remove all tags from the display text
		const displayText = line.replace(TAG_REGEX, "").trim();

		return {
			id: `${file.path}:${lineNumber}`,
			text: displayText,
			filePath: file.path,
			fileName: file.basename,
			line: lineNumber,
			tags: topicTags,
			addedAt: Date.now(),
		};
	}

	/**
	 * Get feedback item at a specific line
	 */
	async getFeedbackAtPosition(
		file: TFile,
		line: number
	): Promise<FeedbackItem | null> {
		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");
		if (line >= lines.length) return null;

		return this.parseFeedbackFromLine(lines[line], line, file);
	}

	/**
	 * Add feedback item silently (no notice)
	 */
	async addFeedbackSilently(item: FeedbackItem): Promise<boolean> {
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
	async removeFeedback(itemId: string): Promise<void> {
		if (!this.data.addedNegativeFeedback[itemId]) return;
		delete this.data.addedNegativeFeedback[itemId];
		await this.saveData();
		new Notice("Negative feedback removed from board");
	}

	/**
	 * Check if feedback is already added
	 */
	isFeedbackAdded(itemId: string): boolean {
		return !!this.data.addedNegativeFeedback[itemId];
	}

	/**
	 * Get all added feedback items (synced with current file state)
	 */
	async getAddedFeedback(): Promise<FeedbackItem[]> {
		const items: FeedbackItem[] = [];
		const toRemove: string[] = [];

		for (const [itemId, item] of Object.entries(this.data.addedNegativeFeedback)) {
			const file = this.app.vault.getAbstractFileByPath(item.filePath);

			if (!(file instanceof TFile)) {
				toRemove.push(itemId);
				continue;
			}

			const content = await this.app.vault.cachedRead(file);
			const lines = content.split("\n");

			// Check if line still exists
			if (item.line >= lines.length) {
				toRemove.push(itemId);
				continue;
			}

			const line = lines[item.line];

			// Check if line still has feedback tag
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
				updatedItem.addedAt = item.addedAt; // Preserve original timestamp
				items.push(updatedItem);
			} else {
				toRemove.push(itemId);
			}
		}

		// Clean up removed items
		if (toRemove.length > 0) {
			for (const id of toRemove) {
				delete this.data.addedNegativeFeedback[id];
			}
			await this.saveData();
		}

		return items;
	}
}
