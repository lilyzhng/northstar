import { App, TFile } from "obsidian";
import { TaskItem } from "./types";

const CHECKBOX_REGEX = /^([\s]*[-*]\s+\[)([ xX])(\]\s*.*)/;

export class TaskToggler {
	constructor(private app: App) {}

	async toggleTask(task: TaskItem): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(task.filePath);
		if (!(file instanceof TFile)) return false;

		const content = await this.app.vault.read(file);
		const lines = content.split("\n");

		if (task.line < 0 || task.line >= lines.length) return false;

		const line = lines[task.line];
		const match = line.match(CHECKBOX_REGEX);
		if (!match) return false;

		const currentState = match[2].toLowerCase();
		const newState = currentState === "x" ? " " : "x";
		lines[task.line] = match[1] + newState + match[3];

		await this.app.vault.modify(file, lines.join("\n"));
		return true;
	}
}
