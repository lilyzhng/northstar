import { requestUrl } from "obsidian";
import { ActaTaskSettings } from "./types";
import { ApiMessage, ApiResponse, ToolDefinition } from "./promiseLandTypes";

export interface LlmMessage {
	role: "user" | "assistant";
	content: string;
}

export class PromiseLandLlmClient {
	constructor(private settings: ActaTaskSettings) {}

	updateSettings(settings: ActaTaskSettings): void {
		this.settings = settings;
	}

	async chat(systemPrompt: string, messages: LlmMessage[]): Promise<string> {
		const apiKey = this.settings.anthropicApiKey;
		if (!apiKey) {
			throw new Error("Anthropic API key not set. Go to Settings → PromiseLand to add it.");
		}

		let response;
		try {
			response = await requestUrl({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: this.settings.promiseLandModel,
					max_tokens: 4096,
					system: systemPrompt,
					messages: messages.map(m => ({ role: m.role, content: m.content })),
				}),
				throw: false,
			});
		} catch (e) {
			throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
		}

		if (response.status === 401) {
			throw new Error("Invalid API key. Check your key in Settings → PromiseLand.");
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

	async chatWithTools(systemPrompt: string, messages: ApiMessage[], tools: ToolDefinition[]): Promise<ApiResponse> {
		const apiKey = this.settings.anthropicApiKey;
		if (!apiKey) {
			throw new Error("Anthropic API key not set. Go to Settings → PromiseLand to add it.");
		}

		let response;
		try {
			response = await requestUrl({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: this.settings.promiseLandModel,
					max_tokens: 4096,
					system: systemPrompt,
					messages: messages.map(m => ({ role: m.role, content: m.content })),
					tools,
				}),
				throw: false,
			});
		} catch (e) {
			throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
		}

		if (response.status === 401) {
			throw new Error("Invalid API key. Check your key in Settings → PromiseLand.");
		}

		if (response.status !== 200) {
			throw new Error(`API error (${response.status}): ${response.text}`);
		}

		const data = response.json;
		return {
			content: data.content || [],
			stop_reason: data.stop_reason || "end_turn",
		};
	}

	async call(systemPrompt: string, userMessage: string): Promise<string> {
		const apiKey = this.settings.anthropicApiKey;
		if (!apiKey) {
			throw new Error("Anthropic API key not set. Go to Settings → PromiseLand to add it.");
		}

		let response;
		try {
			response = await requestUrl({
				url: "https://api.anthropic.com/v1/messages",
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-api-key": apiKey,
					"anthropic-version": "2023-06-01",
				},
				body: JSON.stringify({
					model: this.settings.promiseLandModel,
					max_tokens: 4096,
					system: systemPrompt,
					messages: [{ role: "user", content: userMessage }],
				}),
				throw: false,
			});
		} catch (e) {
			throw new Error(`Network error: ${e instanceof Error ? e.message : String(e)}`);
		}

		if (response.status === 401) {
			throw new Error("Invalid API key. Check your key in Settings → PromiseLand.");
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
}
