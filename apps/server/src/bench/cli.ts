import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { isDeepStrictEqual, parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { getHanabiScore, isHanabiRuleSet, type DebugPlayerAction } from '@hanabi/shared';
import { loadConfig, parseConfig } from './config.js';
import { BenchGame, type BenchTranscript } from './engine.js';
import { runBenchmark, runClimb } from './experiments.js';
import { objectResponse, runGame } from './run.js';
import { createRunDirectory, errorMessage, readJson, writeJson } from './storage.js';

const HELP = `Hanabi Bench — headless play, model evaluation, and convention experiments

pnpm bench play [--players 3] [--rules 5-color] [--seed SEED] [--json]
pnpm bench rules [--players 3] [--rules 5-color]
pnpm bench run [--config FILE] [--seed SEED] [--out DIR] [--watch]
pnpm bench eval --config FILE [--config FILE...] [--games 1] [--seed SEED] [--out DIR]
pnpm bench climb [--config FILE] [--games 50] [--seed SEED] [--out DIR] [--watch]
pnpm bench climb --resume DIR [--games 50] [--watch]
pnpm bench replay TRANSCRIPT.json
pnpm bench review PATH [--port N] [--no-open]

Default model: local authenticated Codex, gpt-6.1-sol, high effort. No API key.
Use bench/configs/scripted.json for offline plumbing checks, not model benchmarks.
Rules: 5-color, 6-color, rainbow, black-powder, rainbow-black-powder.
Critical-card discards or misplays end play/rules games immediately.
--critical-game-over is also accepted for compatibility.
play accepts action IDs, 'play card-1', 'discard card-1', or 'clue player-2 blue'.
JSON play uses one input line per action: {"playerId":"player-1","actionId":"action-0"}.
Output directories must be new. Only climb --resume continues an existing run.
review opens a local read-only viewer for a saved game or hill climb.
run/climb --watch opens the viewer during play and keeps it open until Ctrl+C.
--port and --no-open also work with --watch. No viewer is exposed on the network.
Artifacts default to .context/hanabi-bench/<command>-<unique ID>.
`;

function count(value: string | undefined, fallback: number, name: string): number {
	const result = value === undefined ? fallback : Number(value);
	if (!Number.isSafeInteger(result) || result < 1)
		throw new Error(`${name} must be a positive integer.`);
	return result;
}

type ManualCommand = { playerId: string; actionId: string };

function actionFromLine(game: BenchGame, line: string): ManualCommand {
	const playerId = game.state.currentPlayerId!;
	if (line.startsWith('{')) {
		const value = objectResponse(JSON.parse(line) as unknown);
		if (Object.keys(value).some((key) => !['playerId', 'actionId'].includes(key))) {
			throw new Error('Expected only playerId and actionId.');
		}

		if (
			typeof value.actionId !== 'string' ||
			(value.playerId !== undefined && typeof value.playerId !== 'string')
		) {
			throw new Error('Expected {playerId, actionId}.');
		}
		return { playerId: value.playerId ?? playerId, actionId: value.actionId };
	}
	if (line.startsWith('action-')) return { playerId, actionId: line };
	const parts = line.split(/\s+/);
	let action: DebugPlayerAction;
	if ((parts[0] === 'play' || parts[0] === 'discard') && parts.length === 2) {
		action = { type: parts[0], tileId: parts[1] };
	} else if (parts[0] === 'clue' && parts.length === 3) {
		const number = Number(parts[2]);
		const matching = game
			.legalActions(playerId)
			.find(
				({ action: candidate }) =>
					candidate.type === 'clue' &&
					candidate.to === parts[1] &&
					(candidate.number === number || candidate.color === parts[2]),
			);
		if (!matching) throw new Error('That clue is not legal.');
		return { playerId, actionId: matching.id };
	} else {
		throw new Error(
			'Enter an action ID, play/discard card-ID, clue player-ID color/rank, or quit.',
		);
	}
	const matching = game
		.legalActions(playerId)
		.find((candidate) => isDeepStrictEqual(candidate.action, action));
	if (!matching) throw new Error('That action is not legal.');
	return { playerId, actionId: matching.id };
}

async function manualGame(game: BenchGame, directory: string, json: boolean): Promise<void> {
	await createRunDirectory(directory);
	await writeJson(join(directory, 'transcript.json'), game.transcript());
	const display = () => {
		const observation = game.observe(game.state.currentPlayerId!);
		if (json) {
			process.stdout.write(
				`${JSON.stringify({ type: game.finished ? 'finished' : 'observation', observation })}\n`,
			);
		} else {
			console.log(
				`\nTurn ${game.turn} · ${observation.currentPlayerId} · score ${observation.score}/${observation.maxScore} · clues ${observation.clues} · lives ${observation.lives} · deck ${observation.deckCount}`,
			);
			for (const hand of observation.hands) {
				console.log(
					`${hand.playerId}: ${hand.cards.map((card) => `${card.id}=${card.face ? `${card.face.color}-${card.face.number}` : '?'}${card.clues.colors.length || card.clues.numbers.length ? ` [${[...card.clues.colors, ...card.clues.numbers].join(',')}]` : ''}`).join('  ')}`,
				);
			}
			console.log(
				`Played: ${observation.played.map((card) => `${card.color}-${card.number}`).join(', ') || 'none'}`,
			);
			console.log(
				`Discarded: ${observation.discarded.map((card) => `${card.color}-${card.number}`).join(', ') || 'none'}`,
			);
			console.log(`Last event: ${JSON.stringify(observation.events.at(-1) ?? null)}`);
			if (game.finished) console.log(`Finished: ${observation.finishedReason}`);
			else
				console.log(
					observation.legalActions
						.map(({ id, action }) => `${id}: ${JSON.stringify(action)}`)
						.join('\n'),
				);
		}
	};
	if (json) console.log(JSON.stringify({ type: 'rules', rules: game.rules() }));
	else console.log(game.rules());
	display();
	const input = createInterface({ input: process.stdin, terminal: false });
	try {
		for await (const raw of input) {
			const line = raw.trim();
			if (!line) continue;
			if (line === 'quit') break;
			try {
				const command = actionFromLine(game, line);
				game.apply(command.playerId, command.actionId);
			} catch (error) {
				if (json) console.log(JSON.stringify({ type: 'error', error: errorMessage(error) }));
				else console.error(errorMessage(error));
				continue;
			}
			await writeJson(join(directory, 'transcript.json'), game.transcript());
			display();
			if (game.finished) break;
		}
	} finally {
		input.close();
	}
	console.error(`Transcript: ${join(directory, 'transcript.json')}`);
}

export async function main(args = process.argv.slice(2)): Promise<number> {
	const { values, positionals } = parseArgs({
		args,
		allowPositionals: true,
		strict: true,
		options: {
			config: { type: 'string', multiple: true },
			out: { type: 'string' },
			seed: { type: 'string' },
			games: { type: 'string' },
			players: { type: 'string' },
			rules: { type: 'string' },
			resume: { type: 'string' },
			json: { type: 'boolean' },
			watch: { type: 'boolean' },
			port: { type: 'string' },
			'no-open': { type: 'boolean' },
			'critical-game-over': { type: 'boolean' },
			help: { type: 'boolean', short: 'h' },
		},
	});
	const command = positionals[0];
	if (values.help || !command) {
		console.log(HELP);
		return 0;
	}
	const allowed: Record<string, string[]> = {
		play: ['players', 'rules', 'seed', 'json', 'out', 'critical-game-over'],
		rules: ['players', 'rules', 'critical-game-over'],
		run: ['config', 'out', 'seed', 'watch', 'port', 'no-open'],
		eval: ['config', 'out', 'seed', 'games'],
		climb: ['config', 'out', 'seed', 'games', 'resume', 'watch', 'port', 'no-open'],
		review: ['port', 'no-open'],
		replay: [],
	};
	if (!Object.hasOwn(allowed, command)) throw new Error(`Unknown command: ${command}. Use --help.`);
	for (const key of Object.keys(values)) {
		if (!allowed[command].includes(key))
			throw new Error(`--${key} is not supported for ${command}.`);
	}
	if (positionals.length !== (['replay', 'review'].includes(command) ? 2 : 1))
		throw new Error('Unexpected or missing positional argument. Use --help.');
	if (values.seed !== undefined && !values.seed.trim())
		throw new Error('--seed must not be empty.');
	if (values.resume !== undefined && !values.resume.trim())
		throw new Error('--resume must not be empty.');
	if (
		command !== 'review' &&
		!values.watch &&
		(values.port !== undefined || values['no-open'] !== undefined)
	)
		throw new Error('--port and --no-open require --watch for run/climb.');
	const port = values.port === undefined ? undefined : Number(values.port);
	if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535))
		throw new Error('--port must be an integer from 1 through 65535.');
	if (command === 'review' && !positionals[1].trim())
		throw new Error('Review path must not be empty.');
	if (
		command === 'climb' &&
		values.resume !== undefined &&
		(values.config !== undefined || values.seed !== undefined || values.out !== undefined)
	)
		throw new Error('--resume uses the saved directory, configuration, and seed.');
	const games =
		command === 'climb' || command === 'eval'
			? count(values.games, command === 'climb' ? 50 : 1, 'games')
			: undefined;
	if (command === 'replay') {
		const transcript = (await readJson(resolve(positionals[1]))) as BenchTranscript;
		if (transcript.version !== 1 || !Array.isArray(transcript.events))
			throw new Error(
				'Unsupported transcript; only version 1 games without tile movement can be replayed.',
			);
		const game = new BenchGame(transcript.options);
		for (const event of transcript.events) {
			const action = game
				.legalActions(event.playerId)
				.find((candidate) => isDeepStrictEqual(candidate.action, event.action));
			if (!action) throw new Error(`Invalid replay action at turn ${event.turn}.`);
			game.apply(event.playerId, action.id);
		}
		if (!isDeepStrictEqual(game.transcript(), transcript))
			throw new Error('Transcript does not match deterministic replay.');
		console.log(
			JSON.stringify({
				verified: true,
				turns: game.turn,
				finished: game.finished,
				score: getHanabiScore(game.state),
			}),
		);
		return 0;
	}
	const directory = resolve(
		values.out ?? join('.context', 'hanabi-bench', `${command}-${randomUUID()}`),
	);
	if (command === 'play' || command === 'rules') {
		const ruleSet = values.rules ?? '5-color';
		if (!isHanabiRuleSet(ruleSet)) throw new Error(`Unknown rule set: ${ruleSet}.`);
		const game = new BenchGame({
			seed: values.seed ?? randomUUID(),
			playerCount: count(values.players, 3, 'players'),
			ruleSet,
			criticalGameOver: true,
			allowDragging: false,
		});
		if (command === 'rules') console.log(game.rules());
		else await manualGame(game, directory, values.json ?? false);
		return 0;
	}
	const controller = new AbortController();
	let viewer: Awaited<ReturnType<typeof import('./reviewServer.js').startReviewServer>> | undefined;
	const abort = () => {
		controller.abort(new Error('Interrupted by user.'));
		void viewer?.close().catch((error: unknown) => console.error(errorMessage(error)));
	};
	const startViewer = async (root: string, allowMissing = false) => {
		controller.signal.throwIfAborted();
		if (!allowMissing && !(await stat(root)).isDirectory())
			throw new Error('Review path must be a directory.');
		const { startReviewServer } = await import('./reviewServer.js');
		viewer = await startReviewServer({
			directory: root,
			signal: controller.signal,
			port,
			open: !values['no-open'],
			allowMissing,
		});
		if (controller.signal.aborted) {
			await viewer.close();
			controller.signal.throwIfAborted();
		}
		console.error(`Review: ${viewer.url}`);
	};
	const finish = async (code: number) => {
		if (viewer && !controller.signal.aborted) {
			console.error('Viewer remains open. Press Ctrl+C to close.');
			await viewer.closed;
		}
		return code;
	};
	process.once('SIGINT', abort);
	process.once('SIGTERM', abort);
	try {
		if (command === 'review') {
			await startViewer(resolve(positionals[1]));
			return await finish(0);
		}
		const common = {
			directory,
			signal: controller.signal,
			seed: values.seed,
			onProgress: (message: string) => console.error(message),
		};
		if (command === 'climb' && values.resume !== undefined) {
			if (values.watch) await startViewer(resolve(values.resume));
			const state = await runClimb({
				...common,
				directory: resolve(values.resume),
				resume: true,
				games: games!,
			});
			console.log(
				JSON.stringify({
					directory: resolve(values.resume),
					iterations: state.iterations.length,
					currentVersion: state.currentVersion,
				}),
			);
			return await finish(state.iterations.at(-1)?.status === 'completed' ? 0 : 1);
		}
		const configs = values.config
			? await Promise.all(values.config.map(loadConfig))
			: [await parseConfig({})];
		if (command !== 'eval' && configs.length !== 1)
			throw new Error(`${command} takes exactly one configuration.`);
		console.error(`Artifacts: ${directory}`);
		if (values.watch) await startViewer(directory, true);
		if (command === 'run') {
			const result = await runGame({
				...common,
				config: configs[0],
				seed: values.seed ?? randomUUID(),
			});
			console.log(JSON.stringify({ directory, ...result }));
			return await finish(result.status === 'completed' ? 0 : 1);
		}
		if (command === 'eval') {
			const report = await runBenchmark({
				...common,
				configs,
				games: games!,
			});
			console.log(
				JSON.stringify({
					directory,
					configurations: report.configurations.map(({ name, summary }) => ({ name, ...summary })),
				}),
			);
			return report.configurations.some(({ summary }) => summary.failed) ? 1 : 0;
		}
		const state = await runClimb({
			...common,
			config: configs[0],
			games: games!,
		});
		console.log(
			JSON.stringify({
				directory,
				iterations: state.iterations.length,
				currentVersion: state.currentVersion,
			}),
		);
		return await finish(state.iterations.at(-1)?.status === 'completed' ? 0 : 1);
	} finally {
		await viewer?.close();
		process.removeListener('SIGINT', abort);
		process.removeListener('SIGTERM', abort);
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	main()
		.then((code) => {
			process.exitCode = code;
		})
		.catch((error: unknown) => {
			console.error(`Hanabi Bench: ${errorMessage(error)}`);
			process.exitCode = 1;
		});
}
