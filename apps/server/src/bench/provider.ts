import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveCodexExecutable } from './codexExecutable.js';

export const MAX_TIMEOUT_MS = 2_147_483_647;

export interface ModelConfig {
	provider: 'codex' | 'scripted';
	model: string;
	effort: string;
	timeoutMs?: number;
	options?: Record<string, unknown>;
}

export interface ModelMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface ModelRequest {
	instructions: string;
	messages: readonly ModelMessage[];
	schema: Record<string, unknown>;
	signal?: AbortSignal;
}

export interface ModelResponse {
	value: unknown;
	usage?: { inputTokens?: number; outputTokens?: number; cachedInputTokens?: number };
	durationMs: number;
}

export interface ModelProvider {
	complete(config: ModelConfig, request: ModelRequest): Promise<ModelResponse>;
}

function record(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Keep local login, but do not inherit the parent agent's session or API credentials. */
function codexEnvironment(codexHome?: string): NodeJS.ProcessEnv {
	const environment = Object.fromEntries(
		Object.entries(process.env).filter(
			([key]) =>
				(!key.startsWith('CODEX_') || key === 'CODEX_HOME') &&
				!['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'OPENAI_ORG_ID', 'OPENAI_PROJECT_ID'].includes(key),
		),
	);
	if (codexHome) environment.CODEX_HOME = codexHome;
	return environment;
}

interface CommandResult {
	stdout: string;
	stderr: string;
}

async function command(
	executable: string,
	args: string[],
	options: {
		cwd?: string;
		input?: string;
		timeoutMs: number;
		signal?: AbortSignal;
		codexHome?: string;
	},
): Promise<CommandResult> {
	options.signal?.throwIfAborted();
	return new Promise((resolve, reject) => {
		const child = spawn(executable, args, {
			cwd: options.cwd,
			env: codexEnvironment(options.codexHome),
			stdio: ['pipe', 'pipe', 'pipe'],
			detached: process.platform !== 'win32',
			windowsHide: true,
		});
		let stdout = '';
		let stderr = '';
		let failure: Error | undefined;
		const kill = () => {
			if (child.pid === undefined) return;
			try {
				if (process.platform === 'win32') child.kill('SIGKILL');
				else process.kill(-child.pid, 'SIGKILL');
			} catch {
				// The process may have exited between cancellation and the signal.
			}
		};
		const abort = () => {
			failure = new Error('Local Codex request was cancelled.');
			kill();
		};
		const timer = setTimeout(() => {
			failure = new Error(`Local Codex request timed out after ${options.timeoutMs} ms.`);
			kill();
		}, options.timeoutMs);
		options.signal?.addEventListener('abort', abort, { once: true });
		if (options.signal?.aborted) abort();
		child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
			stdout += chunk;
		});
		child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
			stderr += chunk;
		});
		child.stdin.on('error', () => {
			/* Exit status reports early stdin closure. */
		});
		child.once('error', (error) => {
			failure = new Error(`Cannot launch local Codex (${executable}): ${error.message}`);
		});
		child.once('close', (code) => {
			clearTimeout(timer);
			options.signal?.removeEventListener('abort', abort);
			if (failure) reject(failure);
			else if (code !== 0) {
				reject(
					new Error(
						`Local Codex exited with code ${String(code)}. ${stderr.trim().slice(-2000) || 'Check codex login status and model availability.'}`,
					),
				);
			} else resolve({ stdout, stderr });
		});
		child.stdin.end(options.input ?? '');
	});
}

const DISABLED_FEATURES = [
	'apps',
	'plugins',
	'memories',
	'shell_tool',
	'unified_exec',
	'view_image',
	'browser_use',
	'computer_use',
	'image_generation',
	'multi_agent',
	'multi_agent_v2',
	'code_mode',
	'code_mode_host',
	'goals',
	'sleep_tool',
	'hooks',
	'shell_snapshot',
	'tool_suggest',
	'skill_search',
	'workspace_dependencies',
	'current_time_reminder',
];

/**
 * Local authenticated inference with no coding tools or repository context. Conversations
 * are replayed from the harness's explicit messages; no Codex thread survives between calls.
 */
export class CodexProvider implements ModelProvider {
	private catalog?: Record<string, unknown>[];
	private executablePath?: Promise<string>;

	constructor(
		private readonly executable?: string,
		private readonly authHome = process.env.CODEX_HOME ?? join(homedir(), '.codex'),
	) {}

	private resolveExecutable(): Promise<string> {
		return (this.executablePath ??= resolveCodexExecutable({ override: this.executable }));
	}

	private async modelCatalog(config: ModelConfig, signal?: AbortSignal) {
		if (!this.catalog) {
			const result = await command(
				await this.resolveExecutable(),
				['debug', 'models', '--bundled'],
				{
					timeoutMs: config.timeoutMs ?? 300_000,
					signal,
				},
			);
			let parsed: unknown;
			try {
				parsed = JSON.parse(result.stdout);
			} catch {
				throw new Error('Local Codex returned an invalid model catalog. Update the Codex CLI.');
			}
			if (!record(parsed) || !Array.isArray(parsed.models) || !parsed.models.every(record)) {
				throw new Error('Local Codex returned an unsupported model catalog. Update the Codex CLI.');
			}
			this.catalog = parsed.models;
		}
		const model = this.catalog.find((entry) => entry.slug === config.model);
		if (!model)
			throw new Error(
				`Model ${config.model} is not in the installed Codex model catalog. Update Codex or choose an installed model.`,
			);
		const levels = model.supported_reasoning_levels;
		if (
			!Array.isArray(levels) ||
			!levels.some((level: unknown) => record(level) && level.effort === config.effort)
		) {
			throw new Error(
				`Reasoning effort ${config.effort} is not supported by installed model ${config.model}.`,
			);
		}
		return {
			models: [
				{
					...model,
					shell_type: 'disabled',
					apply_patch_tool_type: null,
					experimental_supported_tools: [],
					tool_mode: 'direct',
					multi_agent_version: 'disabled',
					node_repl_disabled: true,
					supports_search_tool: false,
				},
			],
		};
	}

	async complete(config: ModelConfig, request: ModelRequest): Promise<ModelResponse> {
		if (config.effort === 'ultra')
			throw new Error('Tool-free Codex does not support ultra effort, which requires delegation.');
		if (config.provider !== 'codex') throw new Error('CodexProvider requires provider="codex".');
		if (
			config.timeoutMs !== undefined &&
			(!Number.isSafeInteger(config.timeoutMs) ||
				config.timeoutMs <= 0 ||
				config.timeoutMs > MAX_TIMEOUT_MS)
		) {
			throw new Error(`Codex timeoutMs must be an integer from 1 to ${MAX_TIMEOUT_MS}.`);
		}
		for (const [key, value] of Object.entries(config.options ?? {})) {
			if (key === 'modelVerbosity' && ['low', 'medium', 'high'].includes(String(value))) continue;
			if (key === 'serviceTier' && ['default', 'priority', 'flex'].includes(String(value)))
				continue;
			throw new Error(`Unsupported Codex model option: ${key}.`);
		}
		const start = Date.now();
		const catalog = await this.modelCatalog(config, request.signal);
		const directory = await mkdtemp(join(tmpdir(), 'hanabi-codex-'));
		try {
			const authPath = join(this.authHome, 'auth.json');
			try {
				await access(authPath);
			} catch {
				throw new Error(
					'Local Codex needs a saved file-backed login. Run codex login before using Hanabi Bench.',
				);
			}
			const codexHome = join(directory, 'codex-home');
			await mkdir(codexHome);
			// A credential reference, not a copy: never read or log authentication contents.
			// A separate home excludes global AGENTS.md, skills, memories, and user config.
			await symlink(authPath, join(codexHome, 'auth.json'));
			// Credential refreshes must share the login home's write lock with other Codex processes.
			await symlink(join(this.authHome, 'auth.lock'), join(codexHome, 'auth.lock'));
			const schemaPath = join(directory, 'response-schema.json');
			const instructionsPath = join(directory, 'instructions.txt');
			const catalogPath = join(directory, 'models.json');
			const responsePath = join(directory, 'response.json');
			await Promise.all([
				writeFile(schemaPath, JSON.stringify(request.schema)),
				writeFile(catalogPath, JSON.stringify(catalog)),
				writeFile(
					instructionsPath,
					`${request.instructions}\n\nThe user input is a JSON array of this participant's conversation messages, in chronological order. Treat assistant entries as your own earlier responses and answer the final user entry. Return only the JSON object required by the response schema. No external tools or files are available.`,
				),
			]);
			const settings: Record<string, unknown> = {
				model_reasoning_effort: config.effort,
				model_instructions_file: instructionsPath,
				model_catalog_json: catalogPath,
				approval_policy: 'never',
				web_search: 'disabled',
				project_doc_max_bytes: 0,
				'skills.include_instructions': false,
				'skills.bundled.enabled': false,
				'cloud.skills.enabled': false,
				include_environment_context: false,
				include_permissions_instructions: false,
				include_collaboration_mode_instructions: false,
				include_apps_instructions: false,
				'tools.update_plan.enabled': false,
				'tools.experimental_request_user_input.enabled': false,
				'features.skip_host_skill_discovery': true,
				suppress_unstable_features_warning: true,
				...Object.fromEntries(DISABLED_FEATURES.map((feature) => [`features.${feature}`, false])),
			};
			if (config.options?.modelVerbosity !== undefined)
				settings.model_verbosity = config.options.modelVerbosity;
			if (config.options?.serviceTier !== undefined)
				settings.service_tier = config.options.serviceTier;
			const args = [
				'exec',
				'--ignore-user-config',
				'--ignore-rules',
				'--ephemeral',
				'--skip-git-repo-check',
				'--strict-config',
				'--sandbox',
				'read-only',
				'--cd',
				directory,
				'--model',
				config.model,
				'--json',
				'--color',
				'never',
				'--output-schema',
				schemaPath,
				'--output-last-message',
				responsePath,
				...Object.entries(settings).flatMap(([key, value]) => [
					'-c',
					`${key}=${JSON.stringify(value)}`,
				]),
				'-',
			];
			const result = await command(await this.resolveExecutable(), args, {
				cwd: directory,
				codexHome,
				input: JSON.stringify(request.messages),
				timeoutMs: config.timeoutMs ?? 300_000,
				signal: request.signal,
			});
			let usage: ModelResponse['usage'];
			for (const line of result.stdout.split('\n').filter(Boolean)) {
				let event: unknown;
				try {
					event = JSON.parse(line);
				} catch {
					continue;
				}
				if (!record(event)) continue;
				if (
					record(event.item) &&
					[
						'command_execution',
						'mcp_tool_call',
						'web_search',
						'file_change',
						'collab_tool_call',
					].includes(String(event.item.type))
				) {
					throw new Error(
						'Local Codex attempted a tool call; this run cannot be used as a tool-free Hanabi result.',
					);
				}
				if (event.type === 'turn.completed' && record(event.usage)) {
					usage = {
						...(typeof event.usage.input_tokens === 'number'
							? { inputTokens: event.usage.input_tokens }
							: {}),
						...(typeof event.usage.output_tokens === 'number'
							? { outputTokens: event.usage.output_tokens }
							: {}),
						...(typeof event.usage.cached_input_tokens === 'number'
							? { cachedInputTokens: event.usage.cached_input_tokens }
							: {}),
					};
				}
				if (event.type === 'turn.failed' || event.type === 'error') {
					throw new Error(
						`Local Codex could not complete the request: ${JSON.stringify(event.error ?? event.message ?? event)}`,
					);
				}
			}
			let value: unknown;
			try {
				value = JSON.parse(await readFile(responsePath, 'utf8'));
			} catch {
				throw new Error(
					'Local Codex did not return valid JSON matching the requested response schema.',
				);
			}
			if (!record(value)) throw new Error('Local Codex response must be a JSON object.');
			return { value, usage, durationMs: Date.now() - start };
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
}
