import { App, Modal, Setting } from "obsidian";

export class NorthStarGoalModal extends Modal {
	private goalText = "";
	private timeWindowDays = 30;
	private onSubmit: (goalText: string, timeWindowDays: number) => void;

	constructor(app: App, onSubmit: (goalText: string, timeWindowDays: number) => void) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h3", { text: "Set Your North Star" });
		contentEl.createEl("p", {
			text: "Define your goal and lock it in. The goal cannot be changed — only archived and replaced.",
			cls: "setting-item-description",
		});

		new Setting(contentEl)
			.setName("Goal")
			.setDesc("What are you working toward?")
			.addTextArea((text) =>
				text
					.setPlaceholder("e.g., Land a Post-Training Research Engineer role")
					.onChange((value) => {
						this.goalText = value;
					})
			);

		new Setting(contentEl)
			.setName("Time window (days)")
			.setDesc("How many days to reach this goal?")
			.addText((text) =>
				text
					.setPlaceholder("30")
					.setValue("30")
					.onChange((value) => {
						const num = parseInt(value, 10);
						if (!isNaN(num) && num > 0) {
							this.timeWindowDays = num;
						}
					})
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn
					.setButtonText("Lock It In")
					.setCta()
					.onClick(() => {
						if (this.goalText.trim().length === 0) return;
						this.onSubmit(this.goalText.trim(), this.timeWindowDays);
						this.close();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
