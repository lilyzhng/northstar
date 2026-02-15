// North Star — All interfaces, constants, and defaults

export interface NorthStarGoal {
	id: string;
	text: string;
	context?: string;
	timeWindowDays: number;
	lockedAt: number; // timestamp
	currentPhase: "exploration" | "execution" | "refinement";
	active: boolean;
}

export interface SignalWeights {
	goalDirectDeepWork: number;
	taskCompletion: number;
	reflectionDepth: number;
	pipelineActivity: number;
	feedbackSignals: number;
}

export interface Milestone {
	id: string;
	text: string;
	deadline: string; // ISO date string
	completed: boolean;
	completedAt?: number;
	droppedAt?: number;
	reason?: string;
}

export interface NorthStarPolicy {
	signalWeights: SignalWeights;
	checkInPrompts: string[];
	milestones: Milestone[];
	version: number;
}

export interface TaskSignal {
	title: string;
	tags: string[];
	completed: boolean;
	timeAnnotation?: string;
	durationMin?: number;
	effort: "deep_work" | "quick_action";
	priority: boolean;
}

export interface FeedbackSignal {
	text: string;
	tags: string[];
	type: "positive" | "negative";
}

export interface ReflectionSignal {
	text: string;
	filePath: string;
}

export interface VaultActivity {
	filesModified: number;
	foldersActive: string[];
}

export interface DaySignals {
	date: string;
	tasks: TaskSignal[];
	feedback: FeedbackSignal[];
	reflections: ReflectionSignal[];
	vaultActivity: VaultActivity;
}

export interface SignalBreakdownItem {
	category: string;
	weight: number;
	score: number;
	maxScore: number;
	reasoning: string;
}

export interface Assessment {
	id: string;
	goalId: string;
	date: string;
	dayNumber: number;
	overallScore: number; // 0-100
	signalBreakdown: SignalBreakdownItem[];
	driftIndicators: string[];
	momentumIndicators: string[];
	rawSignals: DaySignals;
	policyVersion: number;
}

export interface GoalContext {
	goal: NorthStarGoal;
	policy: NorthStarPolicy;
	assessments: Assessment[];
	tinkerMessages: TinkerMessage[];
}

// Anthropic API content block types for tool use
export interface TextBlock { type: "text"; text: string }
export interface ToolUseBlock { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
export interface ToolResultBlock { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean }
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface ApiMessage { role: "user" | "assistant"; content: string | ContentBlock[] }
export interface ToolDefinition { name: string; description: string; input_schema: Record<string, unknown> }
export interface ApiResponse { content: ContentBlock[]; stop_reason: string }

export interface TinkerMessage {
	role: "user" | "assistant";
	content: string;
	timestamp: number;
	assessmentId?: string;
	referencedFiles?: { path: string; basename: string }[];
}

export interface ActaNorthStarData {
	goalContexts: GoalContext[];
	archivedGoals: NorthStarGoal[];
	activeGoalId?: string | null;
	tinkerMessages?: TinkerMessage[]; // Legacy: shared messages (migrated to per-goal)
	// Legacy fields for migration (pre-multi-goal)
	goal?: NorthStarGoal | null;
	policy?: NorthStarPolicy;
	assessments?: Assessment[];
}

export const DEFAULT_SIGNAL_WEIGHTS: SignalWeights = {
	goalDirectDeepWork: 0.30,
	taskCompletion: 0.15,
	reflectionDepth: 0.25,
	pipelineActivity: 0.20,
	feedbackSignals: 0.10,
};

export const DEFAULT_POLICY: NorthStarPolicy = {
	signalWeights: { ...DEFAULT_SIGNAL_WEIGHTS },
	checkInPrompts: [],
	milestones: [],
	version: 1,
};

export const DEFAULT_NORTHSTAR_DATA: ActaNorthStarData = {
	goalContexts: [],
	archivedGoals: [],
};

export const TIME_ANNOTATION_REGEX = /@(\d{1,2}(?::?\d{2})?)\s*(?:AM|PM|am|pm)?\s*[-–]\s*(\d{1,2}(?::?\d{2})?)\s*(?:AM|PM|am|pm)?/;
