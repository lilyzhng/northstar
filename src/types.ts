export interface TaskItem {
	id: string;           // `${filePath}:${lineNumber}`
	text: string;         // Task text (without the checkbox syntax and emoji)
	completed: boolean;
	filePath: string;
	fileName: string;
	line: number;         // 0-indexed line number in source file
	tags: string[];       // Tags from the note
	addedAt: number;      // Timestamp when added to board
}

export interface TopicGroup {
	tag: string;          // Raw tag e.g. "#work"
	displayTag: string;   // Display name e.g. "work"
	tasks: TaskItem[];
	completedCount: number;
	totalCount: number;
}

export interface BoardState {
	topics: TopicGroup[];
	lastUpdated: number;
}

export interface ActaTaskSettings {
	excludedTags: string[];
	excludedFolders: string[];
	showCompleted: boolean;
	showSourceNote: boolean;
	topicSortOrder: "alphabetical" | "taskCount";
	taskSortOrder: "byFile" | "incompleteFirst";
}

export interface ActaTaskData {
	addedTasks: Record<string, TaskItem>; // taskId -> TaskItem
}

export const DEFAULT_SETTINGS: ActaTaskSettings = {
	excludedTags: [],
	excludedFolders: [".obsidian"],
	showCompleted: true,
	showSourceNote: true,
	topicSortOrder: "alphabetical",
	taskSortOrder: "incompleteFirst",
};

export const DEFAULT_DATA: ActaTaskData = {
	addedTasks: {},
};

export const ACTA_TASK_VIEW_TYPE = "acta-task-board";
