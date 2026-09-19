import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_ID = '1f6d2975-b30b-44e5-9ab8-a9fe4803a86f';
const ORIGIN = 'https://hanabi.btraut.com';
const USAGE = `Usage:
  pnpm transcript list [--code CODE] [--player NAME] [--after ISO_TIME] [--before ISO_TIME]
  pnpm transcript fetch ROUND_ID

Times must include Z or a UTC offset. Results are private production data.
Requires Railway CLI authentication and this checkout linked to the Hanabi project.`;

export function parseOptions(args) {
	const [command, ...rest] = args;
	if (command === '--help' || command === 'help' || !command) return { command: 'help' };
	if (command === 'fetch') {
		if (rest.length !== 1 || !/^[a-zA-Z0-9_-]{1,128}$/.test(rest[0])) {
			throw new Error('fetch requires exactly one valid round ID.');
		}
		return { command, roundId: rest[0] };
	}
	if (command !== 'list') throw new Error(USAGE);
	const options = { command };
	for (let i = 0; i < rest.length; i += 2) {
		const key = rest[i].replace(/^--/, '');
		const value = rest[i + 1];
		if (
			!['code', 'player', 'after', 'before'].includes(key) ||
			!rest[i].startsWith('--') ||
			!value ||
			value.startsWith('--') ||
			options[key]
		) {
			throw new Error('Invalid or repeated list filter.\n' + USAGE);
		}
		if (key === 'after' || key === 'before') {
			if (!/(Z|[+-]\d{2}:\d{2})$/i.test(value) || !Number.isFinite(Date.parse(value))) {
				throw new Error('Time filters require an ISO timestamp with Z or a UTC offset.');
			}
		}
		options[key] = value;
	}
	if (options.after && options.before && Date.parse(options.after) >= Date.parse(options.before)) {
		throw new Error('--after must precede --before.');
	}
	return options;
}

export function matchesRound(round, options) {
	return (
		(!options.code || round.gameCode.toLowerCase() === options.code.toLowerCase()) &&
		(!options.player ||
			round.playerNames.some((name) =>
				name.toLowerCase().includes(options.player.toLowerCase()),
			)) &&
		(!options.after || Date.parse(round.recordedAt) >= Date.parse(options.after)) &&
		(!options.before || Date.parse(round.recordedAt) < Date.parse(options.before))
	);
}

function railwayJson(args) {
	try {
		return JSON.parse(
			execFileSync('railway', args, {
				cwd: ROOT,
				encoding: 'utf8',
				stdio: ['ignore', 'pipe', 'pipe'],
				timeout: 30_000,
				maxBuffer: 8 * 1024 * 1024,
			}),
		);
	} catch {
		throw new Error(
			'Railway read failed. Check CLI login and project linkage; no credentials were printed.',
		);
	}
}

export async function createClient(password, request = fetch) {
	const response = await request(`${ORIGIN}/api/admin/session`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ password }),
		redirect: 'error',
		signal: AbortSignal.timeout(30_000),
	});
	if (response.status !== 204)
		throw new Error(`Admin authentication failed (HTTP ${response.status}).`);
	const cookie = response.headers
		.getSetCookie()
		.find((value) => value.startsWith('HANABI_ADMIN='))
		?.split(';', 1)[0];
	if (!cookie) throw new Error('Admin authentication returned no session cookie.');
	return async (path) => {
		const result = await request(`${ORIGIN}/api/admin/${path}`, {
			headers: { cookie },
			redirect: 'error',
			signal: AbortSignal.timeout(30_000),
		});
		if (!result.ok) {
			const error = new Error(`Archive request failed (HTTP ${result.status}).`);
			error.status = result.status;
			throw error;
		}
		if (!result.headers.get('content-type')?.includes('application/json')) {
			const error = new Error('Archive endpoint returned a non-JSON response.');
			error.code = 'NON_JSON_RESPONSE';
			throw error;
		}
		return result.json();
	};
}

export async function listRounds(get, options) {
	const matches = new Map();
	for (let page = 1; page <= 10_000; page++) {
		const result = await get(`transcripts?page=${page}`);
		if (
			!Array.isArray(result.items) ||
			result.page !== page ||
			!(result.pageSize > 0) ||
			!Number.isSafeInteger(result.total) ||
			result.total < 0
		) {
			throw new Error('Invalid archive pagination response.');
		}
		for (const round of result.items) {
			if (matchesRound(round, options)) matches.set(round.roundId, round);
		}
		if (page * result.pageSize >= result.total) return [...matches.values()];
		if (!result.items.length)
			throw new Error('Archive pagination ended before the reported total.');
	}
	throw new Error(
		'Archive scan exceeded 10,000 pages; narrow lookup requires a server-side filter.',
	);
}

export async function fetchRound(get, roundId) {
	let transcript;
	try {
		transcript = await get(`transcripts/${roundId}/export`);
	} catch (error) {
		// Older deployments support finished replays but have no analysis export route.
		if (error.status !== 404 && error.code !== 'NON_JSON_RESPONSE') throw error;
		transcript = await get(`transcripts/${roundId}`);
	}
	if (transcript.roundId !== roundId || !Array.isArray(transcript.moves)) {
		throw new Error('Archive response does not match the requested round.');
	}
	return transcript;
}

async function main() {
	const options = parseOptions(process.argv.slice(2));
	if (options.command === 'help') {
		console.log(USAGE);
		return;
	}
	if (railwayJson(['status', '--json']).id !== PROJECT_ID) {
		throw new Error(
			'This checkout is not linked to the Hanabi Railway project. See the hanabi-transcript skill.',
		);
	}
	const variables = railwayJson([
		'variables',
		'--service',
		'hanabi',
		'--environment',
		'production',
		'--json',
	]);
	if (!variables.ADMIN_PASSWORD)
		console.error('Production ADMIN_PASSWORD is unset; the documented default is active.');
	const get = await createClient(variables.ADMIN_PASSWORD || 'tenfour');
	if (options.command === 'list') {
		console.log(JSON.stringify(await listRounds(get, options), null, 2));
		return;
	}
	const transcript = await fetchRound(get, options.roundId);
	const directory = join(ROOT, '.context', 'game-transcripts');
	mkdirSync(directory, { recursive: true, mode: 0o700 });
	const path = join(directory, `${options.roundId}-${Date.now()}.json`);
	writeFileSync(path, JSON.stringify(transcript, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
	console.log(
		JSON.stringify(
			{
				path,
				roundId: transcript.roundId,
				status: transcript.lifecycle.status,
				integrity: transcript.integrity,
				moves: transcript.moves.length,
				chatCoverage: transcript.chat?.coverage ?? 'unavailable',
				chatMessages: transcript.chat?.messages.length ?? null,
			},
			null,
			2,
		),
	);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		// Network errors and library stacks can include request details; print only our safe messages.
		console.error(
			error instanceof Error && !error.cause
				? error.message
				: 'Transcript fetch failed. Check network access and retry.',
		);
		process.exitCode = 1;
	});
}
