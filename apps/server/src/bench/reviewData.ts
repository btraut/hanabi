import { readFile, readdir, realpath } from 'node:fs/promises';
import { basename, isAbsolute, join, relative } from 'node:path';
import {
	getHanabiMaxScore,
	getHanabiScore,
	type BenchReviewLog,
	type BenchReviewSnapshot,
	type BenchReviewGameSummary,
} from '@hanabi/shared';
import type { BenchTranscript } from './engine.js';
import { parseRevision } from './experiments.js';
import { toReviewTranscript } from './reviewTranscript.js';
import { objectResponse } from './run.js';

async function artifactPath(root: string, path: string): Promise<string> {
	const canonical = await realpath(path);
	const child = relative(root, canonical);
	if (child === '..' || child.startsWith('../') || child.startsWith('..\\') || isAbsolute(child))
		throw new Error('Review artifacts must stay inside the selected directory.');
	return canonical;
}

async function optionalText(root: string, path: string): Promise<string | null> {
	try {
		return await readFile(await artifactPath(root, path), 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

async function optionalJson(root: string, path: string): Promise<unknown> {
	const text = await optionalText(root, path);
	return text === null ? null : (JSON.parse(text) as unknown);
}

async function numberedDirectories(root: string, path: string): Promise<string[]> {
	try {
		return (await readdir(await artifactPath(root, path), { withFileTypes: true }))
			.filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
			.map((entry) => entry.name)
			.sort((a, b) => Number(a) - Number(b));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
}

/** Only known artifact directories are exposed; a request never supplies a filesystem path. */
async function gameIds(directory: string): Promise<string[]> {
	if ((await optionalText(directory, join(directory, 'transcript.json'))) !== null) return ['.'];
	const iterations = await numberedDirectories(directory, join(directory, 'iterations'));
	if (iterations.length) return iterations.map((id) => `iterations/${id}/game`);
	const configurations = await numberedDirectories(directory, join(directory, 'games'));
	const ids: string[] = [];
	for (const config of configurations) {
		for (const game of await numberedDirectories(directory, join(directory, 'games', config)))
			ids.push(`games/${config}/${game}`);
	}
	return ids.sort((a, b) => {
		const [, aConfig, aGame] = a.split('/');
		const [, bConfig, bGame] = b.split('/');
		return Number(aGame) - Number(bGame) || Number(aConfig) - Number(bConfig);
	});
}

function readLogs(playerId: string, value: unknown): BenchReviewLog[] {
	if (!Array.isArray(value)) throw new Error(`Invalid private log for ${playerId}.`);
	return value.map((raw: unknown) => {
		const entry = objectResponse(raw);
		const response = objectResponse(entry.response);
		if (
			!Number.isSafeInteger(entry.turn) ||
			(entry.turn as number) < 0 ||
			!['turn', 'result', 'debrief', 'discussion'].includes(String(entry.opportunity))
		)
			throw new Error(`Invalid private log for ${playerId}.`);
		const text = entry.opportunity === 'turn' ? response.explanation : response.reflection;
		if (typeof text !== 'string')
			throw new Error(`Missing explanation in ${playerId}'s private log.`);
		return {
			playerId,
			turn: entry.turn as number,
			opportunity: entry.opportunity as BenchReviewLog['opportunity'],
			text,
		};
	});
}

export async function readReviewSnapshot(
	directory: string,
	selectedId?: string,
): Promise<BenchReviewSnapshot> {
	try {
		directory = await realpath(directory);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		if (selectedId !== undefined) throw new Error('Unknown review game.');
		return { source: directory, games: [], selectedGameId: null, game: null };
	}
	const ids = await gameIds(directory);
	if (selectedId !== undefined && !ids.includes(selectedId))
		throw new Error('Unknown review game.');
	const selectedGameId = selectedId ?? ids.at(-1) ?? null;
	const snapshot: BenchReviewSnapshot = {
		source: directory,
		games: [],
		selectedGameId,
		game: null,
	};
	for (const id of ids) {
		const path = join(directory, id);
		// Read result first so a completed result cannot be paired with an earlier transcript.
		const resultValue = await optionalJson(directory, join(path, 'result.json'));
		const result = resultValue === null ? null : objectResponse(resultValue);
		const raw = (await optionalJson(
			directory,
			join(path, 'transcript.json'),
		)) as BenchTranscript | null;
		const label =
			id === '.'
				? basename(directory)
				: id.startsWith('iterations/')
					? `Game ${Number(id.split('/')[1]) + 1}`
					: `Configuration ${Number(id.split('/')[1]) + 1} · Game ${Number(id.split('/')[2]) + 1}`;
		const summary: BenchReviewGameSummary = {
			id,
			label,
			status:
				result?.status === 'failed'
					? 'failed'
					: result?.status === 'completed'
						? 'completed'
						: raw
							? 'playing'
							: 'waiting',
			score: raw ? getHanabiScore(raw.finalState) : null,
			maxScore: raw ? getHanabiMaxScore(raw.options.ruleSet) : null,
		};
		snapshot.games.push(summary);
		if (id !== selectedGameId || raw === null) continue;
		const configValue = await optionalJson(directory, join(path, 'config.json'));
		const config = configValue === null ? null : objectResponse(configValue);
		const names: Record<string, string> = {};
		if (Array.isArray(config?.players)) {
			config.players.forEach((value: unknown, index: number) => {
				const model = objectResponse(value);
				names[`player-${index + 1}`] =
					`Player ${index + 1} · ${String(model.model)} / ${String(model.effort)}`;
			});
		}
		const transcript = toReviewTranscript(raw, `${directory}/${id}`, names);
		const logs: BenchReviewLog[] = [];
		for (const playerId of transcript.turnOrder) {
			const value = await optionalJson(directory, join(path, 'private', `${playerId}.json`));
			if (value !== null) logs.push(...readLogs(playerId, value));
		}
		let dreamer: NonNullable<BenchReviewSnapshot['game']>['dreamer'] = null;
		if (id.startsWith('iterations/')) {
			const revision = await optionalJson(directory, join(path, '..', 'revision.json'));
			if (revision !== null) {
				dreamer = parseRevision(revision);
			}
		}
		snapshot.game = {
			...summary,
			transcript,
			logs,
			dreamer,
			conventions: (await optionalText(directory, join(path, 'conventions.md'))) ?? '',
			error: typeof result?.error === 'string' ? result.error : null,
		};
	}
	return snapshot;
}
