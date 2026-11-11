import { afterEach, describe, expect, it, vi } from 'vitest';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { CodexProvider, type ModelConfig, type ModelRequest } from './provider.js';

const directories: string[] = [];
const config: ModelConfig = { provider: 'codex', model: 'gpt-6.1-sol', effort: 'high' };
const request: ModelRequest = {
	instructions: 'Play Hanabi from the supplied observation only.',
	messages: [
		{ role: 'user', content: 'Initial visible state' },
		{ role: 'assistant', content: '{"actionId":"action-2","rationale":"Earlier decision"}' },
		{ role: 'user', content: 'Current visible state' },
	],
	schema: {
		type: 'object',
		properties: { actionId: { type: 'string' } },
		required: ['actionId'],
		additionalProperties: false,
	},
};

async function fixture(mode = 'success') {
	const directory = await mkdtemp(join(tmpdir(), 'hanabi-provider-test-'));
	directories.push(directory);
	const executable = join(directory, 'fake-codex');
	await writeFile(join(directory, 'auth.json'), '{}');
	await writeFile(
		executable,
		`#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const mode = ${JSON.stringify(mode)};
if (args[0] === 'debug') {
  process.stdout.write(JSON.stringify({ models: [{ slug: 'gpt-6.1-sol', supported_reasoning_levels: ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].map(effort => ({effort})), shell_type: 'unified_exec', apply_patch_tool_type: 'freeform', experimental_supported_tools: ['clock'] }] }));
} else if (mode === 'failure') {
  process.stderr.write('Requested model is unavailable'); process.exitCode = 7;
} else if (mode === 'wait') {
  fs.writeFileSync(${JSON.stringify(join(directory, 'started'))}, process.cwd());
  setTimeout(() => {}, 60000);
} else {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', text => input += text);
  process.stdin.on('end', () => {
    const output = args[args.indexOf('--output-last-message') + 1];
    const settings = Object.fromEntries(args.flatMap((a, i) => a === '-c' ? [args[i+1].split(/=(.*)/s).slice(0,2)] : []));
    const catalog = JSON.parse(fs.readFileSync(JSON.parse(settings.model_catalog_json), 'utf8'));
    const instructions = fs.readFileSync(JSON.parse(settings.model_instructions_file), 'utf8');
    fs.writeFileSync(${JSON.stringify(join(directory, 'started'))}, process.cwd());
    if (mode === 'invalid') fs.writeFileSync(output, 'not JSON');
    else if (mode === 'array') fs.writeFileSync(output, '[]');
    else fs.writeFileSync(output, JSON.stringify({ actionId: 'action-1', args, input: JSON.parse(input), settings, catalog, instructions, directory: process.cwd(), codexHome: process.env.CODEX_HOME, authTarget: fs.readlinkSync(require('node:path').join(process.env.CODEX_HOME, 'auth.json')), authLockTarget: fs.readlinkSync(require('node:path').join(process.env.CODEX_HOME, 'auth.lock')), apiKeyPresent: !!process.env.OPENAI_API_KEY, threadIdPresent: !!process.env.CODEX_THREAD_ID }));
    if (mode === 'tool') process.stdout.write(JSON.stringify({type:'item.completed', item:{type:'command_execution'}}) + '\\n');
    if (mode === 'turn-failed') process.stdout.write(JSON.stringify({type:'turn.failed',error:{message:'quota exceeded'}}) + '\\n');
    process.stdout.write(JSON.stringify({type:'turn.completed', usage:{input_tokens:123,output_tokens:45,cached_input_tokens:12}}) + '\\n');
  });
}
`,
	);
	await chmod(executable, 0o700);
	return { provider: new CodexProvider(executable, directory), directory };
}

afterEach(async () => {
	vi.unstubAllEnvs();
	await Promise.all(
		directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe('local Codex provider', () => {
	it('uses an explicit executable when the calling terminal has no Codex on PATH', async () => {
		const { directory } = await fixture();
		vi.stubEnv('PATH', '/nonexistent/hanabi-bin');
		vi.stubEnv('HANABI_CODEX_PATH', join(directory, 'fake-codex'));
		const response = await new CodexProvider(undefined, directory).complete(config, request);
		expect(response.value).toHaveProperty('actionId', 'action-1');
	});

	it('replays only explicit messages with a tool-free catalog and isolated instructions', async () => {
		vi.stubEnv('OPENAI_API_KEY', 'must-not-be-inherited');
		vi.stubEnv('CODEX_THREAD_ID', 'parent-session');
		const { provider, directory } = await fixture();
		const response = await provider.complete(
			{ ...config, options: { modelVerbosity: 'high', serviceTier: 'priority' } },
			request,
		);
		const value = response.value as {
			args: string[];
			input: unknown;
			settings: Record<string, string>;
			catalog: { models: Record<string, unknown>[] };
			instructions: string;
			directory: string;
			codexHome: string;
			authTarget: string;
			authLockTarget: string;
			apiKeyPresent: boolean;
			threadIdPresent: boolean;
		};
		expect(value.input).toEqual(request.messages);
		expect(value.instructions).toContain(request.instructions);
		expect(value.args).toEqual(
			expect.arrayContaining([
				'--ignore-user-config',
				'--ephemeral',
				'--strict-config',
				'--skip-git-repo-check',
				'--sandbox',
				'read-only',
			]),
		);
		expect(value.settings).toMatchObject({
			'features.shell_tool': 'false',
			'features.plugins': 'false',
			'features.apps': 'false',
			'features.memories': 'false',
			'skills.include_instructions': 'false',
			project_doc_max_bytes: '0',
			model_reasoning_effort: '"high"',
			model_verbosity: '"high"',
			service_tier: '"priority"',
		});
		expect(value.catalog.models[0]).toMatchObject({
			slug: config.model,
			shell_type: 'disabled',
			apply_patch_tool_type: null,
			experimental_supported_tools: [],
			multi_agent_version: 'disabled',
			tool_mode: 'direct',
		});
		expect(basename(value.codexHome)).toBe('codex-home');
		expect(basename(dirname(value.codexHome))).toBe(basename(value.directory));
		expect(value.authTarget).toBe(join(directory, 'auth.json'));
		expect(value.authLockTarget).toBe(join(directory, 'auth.lock'));
		await expect(readFile(value.authLockTarget)).rejects.toMatchObject({ code: 'ENOENT' });
		expect(await readFile(value.authTarget, 'utf8')).toBe('{}');
		expect(value.apiKeyPresent).toBe(false);
		expect(value.threadIdPresent).toBe(false);
		expect(response.usage).toEqual({ inputTokens: 123, outputTokens: 45, cachedInputTokens: 12 });
		expect(response.durationMs).toBeGreaterThanOrEqual(0);
		await expect(readFile(join(value.directory, 'instructions.txt'))).rejects.toThrow();
	});

	it.each(['invalid', 'array', 'tool', 'turn-failed'])(
		'rejects %s output and removes temporary files',
		async (mode) => {
			const { provider, directory } = await fixture(mode);
			await expect(provider.complete(config, request)).rejects.toThrow(/Local Codex/);
			const working = await readFile(join(directory, 'started'), 'utf8');
			await expect(readFile(join(working, 'instructions.txt'))).rejects.toThrow();
		},
	);

	it('reports nonzero exit errors', async () => {
		const { provider } = await fixture('failure');
		await expect(provider.complete(config, request)).rejects.toThrow(
			/code 7.*model is unavailable/,
		);
	});

	it('reports a missing executable without hanging', async () => {
		await expect(
			new CodexProvider('/nonexistent/hanabi-codex').complete(config, request),
		).rejects.toThrow('Cannot launch local Codex');
	});

	it('kills timed-out processes and cleans their temporary directory', async () => {
		const { provider, directory } = await fixture('wait');
		await expect(provider.complete({ ...config, timeoutMs: 2_000 }, request)).rejects.toThrow(
			'timed out',
		);
		const working = await readFile(join(directory, 'started'), 'utf8');
		await expect(readFile(join(working, 'instructions.txt'))).rejects.toThrow();
	});

	it('cancels an active request', async () => {
		const { provider, directory } = await fixture('wait');
		const controller = new AbortController();
		const response = provider.complete(config, { ...request, signal: controller.signal });
		const settled = response.then(
			(value) => ({ value, error: null }),
			(error: unknown) => ({ value: null, error }),
		);
		try {
			// Wait for inference to start; a timer can abort during catalog/auth preparation.
			const working = await vi.waitFor(() => readFile(join(directory, 'started'), 'utf8'), {
				timeout: 5_000,
				interval: 20,
			});
			controller.abort();
			expect((await settled).error).toMatchObject({
				message: 'Local Codex request was cancelled.',
			});
			await expect(readFile(join(working, 'instructions.txt'))).rejects.toThrow();
		} finally {
			controller.abort();
			await settled;
		}
	}, 10_000);

	it('does not launch an already aborted request', async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(
			new CodexProvider('/nonexistent/hanabi-codex').complete(config, {
				...request,
				signal: controller.signal,
			}),
		).rejects.toThrow();
	});

	it('reports a missing saved login without copying credentials', async () => {
		const { directory } = await fixture();
		await rm(join(directory, 'auth.json'));
		await expect(
			new CodexProvider(join(directory, 'fake-codex'), directory).complete(config, request),
		).rejects.toThrow('saved file-backed login');
	});

	it.each(['none', 'minimal', 'ultra'])(
		'rejects unavailable tool-free effort %s before inference',
		async (effort) => {
			const { provider, directory } = await fixture();
			await expect(provider.complete({ ...config, effort }, request)).rejects.toThrow(/effort/i);
			await expect(readFile(join(directory, 'started'))).rejects.toMatchObject({ code: 'ENOENT' });
		},
	);

	it.each([0, 1.5, 2_147_483_648])(
		'rejects invalid timeout %s before launching Codex',
		async (timeoutMs) => {
			await expect(
				new CodexProvider('/nonexistent/hanabi-codex').complete({ ...config, timeoutMs }, request),
			).rejects.toThrow('timeoutMs');
		},
	);

	it('accepts the maximum timer delay', async () => {
		const { provider } = await fixture();
		await expect(
			provider.complete({ ...config, timeoutMs: 2_147_483_647 }, request),
		).resolves.toBeDefined();
	});

	it('rejects unsafe config overrides and unavailable models', async () => {
		const { provider } = await fixture();
		await expect(
			provider.complete({ ...config, options: { 'features.shell_tool': true } }, request),
		).rejects.toThrow('Unsupported Codex model option');
		await expect(provider.complete({ ...config, model: 'missing-model' }, request)).rejects.toThrow(
			'not in the installed Codex model catalog',
		);
	});
});
