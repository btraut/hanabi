import {
	generateHanabiGameData,
	generatePlayer,
	HanabiStage,
	type DebugPlayerAction,
} from '@hanabi/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appendBotArrangement, createBotHistory } from './BotHistory.js';
import { createBotPolicy, createRoundBotPolicy } from './BotPolicy.js';
import { isBotRound, type BotRound } from './BotRound.js';
import { BotRuntime, type BotLimits } from './BotRuntime.js';
import { BotTurnCoordinator, MAX_BOT_INPUT_BYTES, type BotTurn } from './BotTurnCoordinator.js';
import { BotDecisionError, type BotDecision, type BotDecisionProvider } from './OpenAiBot.js';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((done, fail) => {
		resolve = done;
		reject = fail;
	});
	return { promise, resolve, reject };
}

async function flush() {
	for (let index = 0; index < 40; index += 1) await Promise.resolve();
}

function botTurn(roundOverrides: Partial<BotRound> = {}, tileId = 'own'): BotTurn {
	const gameData = generateHanabiGameData({
		seed: 'round-1',
		stage: HanabiStage.Playing,
		players: {
			bot: generatePlayer({ id: 'bot', name: 'Bot', kind: 'bot' }),
			human: generatePlayer({ id: 'human', name: 'Human' }),
		},
		turnOrder: ['bot', 'human'],
		currentPlayerId: 'bot',
		clues: 7,
		tiles: {
			[tileId]: { id: tileId, color: 'red', number: 1 },
			other: { id: 'other', color: 'blue', number: 2 },
		},
		playerTiles: { bot: [tileId], human: ['other'] },
	});
	return {
		playerId: 'bot',
		gameData,
		round: {
			version: 1,
			roundId: gameData.seed,
			policy: createBotPolicy('test-model', ''),
			history: createBotHistory(gameData),
			revision: 0,
			attempts: 0,
			tokens: 0,
			status: 'ready',
			lastAttemptAt: 0,
			...roundOverrides,
		},
	};
}

function harness(
	options: {
		turn?: BotTurn;
		provider?: BotDecisionProvider;
		runtime?: BotRuntime;
		limits?: Partial<BotLimits>;
		persist?: () => Promise<void>;
		apply?: (playerId: string, action: DebugPlayerAction) => string | null;
	} = {},
) {
	let current: BotTurn | null = options.turn ?? botTurn();
	const original = current;
	const chooseAction = vi
		.fn<BotDecisionProvider['chooseAction']>()
		.mockResolvedValue({ actionId: 'action-0', inputTokens: 100, outputTokens: 5 });
	const runtime =
		options.runtime ??
		new BotRuntime(options.provider ?? { chooseAction }, original.round.policy, {
			timeoutMs: 1_000,
			...options.limits,
		});
	const snapshots: BotRound[] = [];
	const notify = vi.fn(() => {
		if (current) snapshots.push(structuredClone(current.round));
	});
	const persist = vi.fn(options.persist ?? (() => Promise.resolve()));
	const apply = vi.fn((playerId: string, action: DebugPlayerAction) => {
		if (options.apply) return options.apply(playerId, action);
		current = null;
		return null;
	});
	const coordinator = new BotTurnCoordinator(runtime, {
		gameId: 'test-game',
		getTurn: () => current,
		persist,
		notify,
		apply,
	});
	return {
		coordinator,
		runtime,
		chooseAction,
		original,
		notify,
		persist,
		apply,
		snapshots,
		setTurn: (turn: BotTurn | null) => {
			current = turn;
		},
	};
}

describe('BotTurnCoordinator', () => {
	const coordinators: BotTurnCoordinator[] = [];
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
		vi.setSystemTime(new Date('2026-09-04T20:00:00Z'));
	});
	afterEach(async () => {
		for (const coordinator of coordinators.splice(0)) coordinator.stop();
		await flush();
		vi.useRealTimers();
	});

	function tracked(options: Parameters<typeof harness>[0] = {}) {
		const value = harness(options);
		coordinators.push(value.coordinator);
		return value;
	}

	it('starts only on explicit activation and persists the reserved budget before a single provider call', async () => {
		const saved = deferred<void>();
		const h = tracked({ persist: () => saved.promise });
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		h.coordinator.start();
		h.coordinator.start();
		await flush();
		expect(h.persist).toHaveBeenCalledTimes(1);
		expect(h.original.round).toMatchObject({ attempts: 1, status: 'thinking' });
		expect(h.original.round.tokens).toBeGreaterThan(0);
		expect(h.coordinator.status()).toEqual({
			playerId: 'bot',
			status: 'thinking',
			canRetry: false,
		});
		expect(h.chooseAction).not.toHaveBeenCalled();
		saved.resolve();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'own' });
		expect(h.original.round.tokens).toBe(105);
		expect(h.coordinator.status()).toBeNull();
	});

	it('does not run the provider when saving its reservation fails', async () => {
		const h = tracked({ persist: () => Promise.reject(new Error('storage unavailable')) });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.apply).not.toHaveBeenCalled();
		expect(h.original.round).toMatchObject({
			status: 'error',
			failure: 'save_failed',
			attempts: 1,
		});
		expect(h.snapshots.at(-1)).toMatchObject({ status: 'error', failure: 'save_failed' });
	});

	it('keeps at most one inference in flight and cannot retry a thinking turn', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi.fn<BotDecisionProvider['chooseAction']>().mockReturnValue(pending.promise),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		for (let index = 0; index < 4; index += 1) h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.coordinator.retry()).toContain('no failed bot turn');
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).toHaveBeenCalledTimes(1);
	});

	it('aborts an old round and ignores its late response after a replacement round', async () => {
		const stale = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(stale.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		const signal = provider.chooseAction.mock.calls[0][0].signal;
		const replacement = botTurn({ roundId: 'round-2' }, 'new-own');
		h.setTurn(replacement);
		h.coordinator.changed();
		await flush();
		expect(signal.aborted).toBe(true);
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'new-own' });
		stale.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).toHaveBeenCalledTimes(1);
	});

	it('replaces a stale observation after public hand rearrangement', async () => {
		const stale = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(stale.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		h.original.gameData.tilePositions = { own: { x: 100, y: 80, z: 1 } };
		h.original.round.revision += 1;
		h.original.round.status = 'ready';
		h.coordinator.changed();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(provider.chooseAction.mock.calls[1][0].observation.players[0].hand[0].position).toEqual({
			x: 100,
			y: 80,
			z: 1,
		});
		stale.resolve({ actionId: 'action-1' });
		await flush();
		expect(h.apply).toHaveBeenCalledExactlyOnceWith('bot', { type: 'play', tileId: 'own' });
	});

	it('stops mutations and releases its slot when stopped during an uncooperative inference', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi.fn<BotDecisionProvider['chooseAction']>().mockReturnValue(pending.promise),
		};
		const h = tracked({ provider, limits: { maxConcurrent: 1 } });
		h.coordinator.start();
		await flush();
		h.coordinator.stop();
		await flush();
		expect(provider.chooseAction.mock.calls[0][0].signal.aborted).toBe(true);
		expect(typeof h.runtime.reserve(1)).toBe('object');
		const notifications = h.notify.mock.calls.length;
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).not.toHaveBeenCalled();
		expect(h.notify).toHaveBeenCalledTimes(notifications);
	});

	it('enforces the total deadline even if the provider ignores cancellation', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi.fn<BotDecisionProvider['chooseAction']>().mockReturnValue(pending.promise),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(1_000);
		await flush();
		expect(h.original.round).toMatchObject({ status: 'error', failure: 'timeout', attempts: 1 });
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: true });
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(h.apply).not.toHaveBeenCalled();
	});

	it('allows only one automatic transient retry, reserving and saving both attempts', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValue(new BotDecisionError('transient')),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.persist).toHaveBeenCalledTimes(2);
		expect(h.original.round).toMatchObject({ attempts: 2, status: 'error', failure: 'transient' });
		expect(h.coordinator.retry()).toContain('Wait a moment');
		await vi.advanceTimersByTimeAsync(2_000);
		expect(h.coordinator.retry()).toBeNull();
		expect(h.coordinator.retry()).not.toBeNull();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(4);
	});

	it('retries a rate limit once and applies a successful response exactly once', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValueOnce(new BotDecisionError('rate_limit'))
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(h.original.round.attempts).toBe(2);
		expect(h.apply).toHaveBeenCalledTimes(1);
	});

	it('shares one deadline across the transient retry', async () => {
		const first = deferred<BotDecision>();
		const second = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(first.promise)
				.mockReturnValue(second.promise),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		await vi.advanceTimersByTimeAsync(700);
		first.reject(new BotDecisionError('transient'));
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		await vi.advanceTimersByTimeAsync(300);
		await flush();
		expect(h.original.round).toMatchObject({ status: 'error', failure: 'timeout', attempts: 2 });
		expect(h.apply).not.toHaveBeenCalled();
	});

	it('cannot spend another attempt on an automatic retry after exhausting the round limit', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValue(new BotDecisionError('transient')),
		};
		const h = tracked({ provider, limits: { roundMaxAttempts: 1 } });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.original.round).toMatchObject({
			attempts: 1,
			status: 'exhausted',
			failure: 'round_budget',
		});
		expect(h.coordinator.status()).toMatchObject({ canRetry: false });
	});

	it('shows unavailable credentials/configuration as disabled with no ineffective retry', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockRejectedValue(new BotDecisionError('unavailable')),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		expect(h.coordinator.status()).toMatchObject({ status: 'disabled', canRetry: false });
		expect(h.coordinator.retry()).not.toBeNull();
		h.coordinator.stop();
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'disabled', canRetry: false });
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
	});

	it.each(['refused', 'incomplete', 'invalid_action'] as const)(
		'does not automatically retry %s',
		async (code) => {
			const provider = {
				chooseAction: vi
					.fn<BotDecisionProvider['chooseAction']>()
					.mockRejectedValue(new BotDecisionError(code)),
			};
			const h = tracked({ provider });
			h.coordinator.start();
			await flush();
			expect(provider.chooseAction).toHaveBeenCalledTimes(1);
			expect(h.original.round).toMatchObject({ status: 'error', failure: code });
		},
	);

	it('rejects an unknown action without making an arbitrary substitute move', async () => {
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockResolvedValue({ actionId: 'invented-action' }),
		};
		const h = tracked({ provider });
		h.coordinator.start();
		await flush();
		expect(h.apply).not.toHaveBeenCalled();
		expect(h.original.round.failure).toBe('invalid_action');
	});

	it('respects the engine rejecting an action whose legality changed', async () => {
		const h = tracked({ apply: () => 'That tile is no longer available.' });
		h.coordinator.start();
		await flush();
		expect(h.apply).toHaveBeenCalledTimes(1);
		expect(h.original.round).toMatchObject({ status: 'error', failure: 'invalid_action' });
	});

	it('refuses a request whose conservative reservation exceeds the remaining round budget', async () => {
		const h = tracked({ limits: { roundMaxTokens: 1_000 } });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.persist).not.toHaveBeenCalled();
		expect(h.original.round).toMatchObject({
			attempts: 0,
			tokens: 0,
			status: 'exhausted',
			failure: 'round_budget',
		});
		expect(h.coordinator.status()).toMatchObject({ status: 'exhausted', canRetry: false });
	});

	it('shares concurrency across games without consuming attempts for a blocked game', async () => {
		const pending = deferred<BotDecision>();
		const provider = {
			chooseAction: vi
				.fn<BotDecisionProvider['chooseAction']>()
				.mockReturnValueOnce(pending.promise)
				.mockResolvedValue({ actionId: 'action-0' }),
		};
		const shared = new BotRuntime(provider, createBotPolicy('test-model', ''), {
			maxConcurrent: 1,
		});
		const first = tracked({ runtime: shared });
		const second = tracked({ runtime: shared });
		first.coordinator.start();
		await flush();
		second.coordinator.start();
		await flush();
		expect(second.original.round).toMatchObject({ attempts: 0, status: 'error', failure: 'busy' });
		expect(provider.chooseAction).toHaveBeenCalledTimes(1);
		pending.resolve({ actionId: 'action-0' });
		await flush();
		expect(second.coordinator.retry()).toBeNull();
		await flush();
		expect(provider.chooseAction).toHaveBeenCalledTimes(2);
		expect(second.apply).toHaveBeenCalledTimes(1);
	});

	it('refreshes Retry after the global allowance renews without making an automatic paid call', async () => {
		const h = tracked({ limits: { globalMaxAttempts: 1, globalWindowMs: 1_000 } });
		const reservation = h.runtime.reserve(1);
		if (typeof reservation === 'string') throw new Error('Expected an initial reservation.');
		reservation.release(1);
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.original.round).toMatchObject({
			status: 'error',
			failure: 'global_budget',
			attempts: 0,
		});
		expect(h.coordinator.status()).toMatchObject({ canRetry: false });
		const notifications = h.notify.mock.calls.length;
		await vi.advanceTimersByTimeAsync(1_000);
		await flush();
		expect(h.notify.mock.calls.length).toBeGreaterThan(notifications);
		expect(h.coordinator.status()).toMatchObject({ canRetry: true });
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.coordinator.retry()).toBeNull();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
	});

	it('notifies once within five seconds of a token refund without unchanged updates or paid calls', async () => {
		const h = tracked({ limits: { globalMaxTokens: 50_000, globalWindowMs: 3_600_000 } });
		const reservation = h.runtime.reserve(50_000);
		if (typeof reservation === 'string') throw new Error('Expected an initial reservation.');
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		const notifications = h.notify.mock.calls.length;

		await vi.advanceTimersByTimeAsync(15_000);
		expect(h.notify).toHaveBeenCalledTimes(notifications);
		expect(h.persist).not.toHaveBeenCalled();
		expect(h.original.round.attempts).toBe(0);
		expect(h.chooseAction).not.toHaveBeenCalled();

		reservation.release(100);
		await vi.advanceTimersByTimeAsync(4_999);
		expect(h.notify).toHaveBeenCalledTimes(notifications);
		await vi.advanceTimersByTimeAsync(1);
		expect(h.notify).toHaveBeenCalledTimes(notifications + 1);
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: true });
		await vi.advanceTimersByTimeAsync(10_000);
		expect(h.notify).toHaveBeenCalledTimes(notifications + 1);
		expect(h.persist).not.toHaveBeenCalled();
		expect(h.chooseAction).not.toHaveBeenCalled();

		expect(h.coordinator.retry()).toBeNull();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
	});

	it('checks restored global-budget errors for refunded allowance without automatic inference', async () => {
		const saved = botTurn({
			status: 'error',
			failure: 'global_budget',
			requiredTokens: 10_000,
			attempts: 2,
			tokens: 1_000,
		});
		const h = tracked({
			turn: saved,
			limits: { globalMaxTokens: 50_000, globalWindowMs: 3_600_000 },
		});
		const reservation = h.runtime.reserve(50_000);
		if (typeof reservation === 'string') throw new Error('Expected an initial reservation.');
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		await vi.advanceTimersByTimeAsync(5_000);
		expect(h.notify).not.toHaveBeenCalled();

		reservation.release(100);
		await vi.advanceTimersByTimeAsync(5_000);
		expect(h.notify).toHaveBeenCalledTimes(1);
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: true });
		expect(saved.round).toMatchObject({ status: 'error', attempts: 2, tokens: 1_000 });
		expect(h.persist).not.toHaveBeenCalled();
		expect(h.chooseAction).not.toHaveBeenCalled();
		await vi.advanceTimersByTimeAsync(10_000);
		expect(h.notify).toHaveBeenCalledTimes(1);
		expect(h.chooseAction).not.toHaveBeenCalled();
	});

	it('permits a request that exactly fits the remaining token allowance', async () => {
		const h = tracked({ limits: { roundMaxTokens: 1_000 } });
		h.coordinator.start();
		await flush();
		expect(h.original.round.status).toBe('exhausted');
		h.runtime.limits.roundMaxTokens = h.original.round.requiredTokens!;
		expect(h.coordinator.status()).toMatchObject({ canRetry: true });
		expect(h.coordinator.retry()).toBeNull();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
	});

	it('resumes a persisted thinking turn with its consumed allowance intact', async () => {
		const saved = JSON.parse(
			JSON.stringify(botTurn({ status: 'thinking', attempts: 5, tokens: 10_000 })),
		) as BotTurn;
		expect(isBotRound(saved.round)).toBe(true);
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
		expect(saved.round.attempts).toBe(6);
		expect(saved.round.tokens).toBe(10_105);
	});

	it('leaves a restored error waiting for a deliberate retry', async () => {
		const saved = JSON.parse(
			JSON.stringify(botTurn({ status: 'error', failure: 'timeout', attempts: 5, tokens: 10_000 })),
		) as BotTurn;
		const h = tracked({ turn: saved });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: true });
		expect(h.coordinator.retry()).toBeNull();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
	});

	it('allows a deliberate retry after restoring unavailable configuration without replacing policy or quota', async () => {
		const saved = JSON.parse(
			JSON.stringify(
				botTurn({
					status: 'error',
					failure: 'unavailable',
					attempts: 5,
					tokens: 10_000,
					policy: createBotPolicy('saved-model', 'Saved coaching instructions.'),
				}),
			),
		) as BotTurn;
		const expected = structuredClone(saved.round);
		delete expected.failure;
		const chooseAction = vi
			.fn<BotDecisionProvider['chooseAction']>()
			.mockResolvedValue({ actionId: 'action-0', inputTokens: 100, outputTokens: 5 });
		const runtime = new BotRuntime(
			{ chooseAction },
			createBotPolicy('new-model', 'New coaching instructions.'),
		);
		const h = tracked({ turn: saved, runtime });
		h.coordinator.start();
		h.coordinator.start();
		await flush();
		expect(chooseAction).not.toHaveBeenCalled();
		expect(h.persist).not.toHaveBeenCalled();
		expect(h.notify).toHaveBeenCalledTimes(1);
		expect(saved.round).toEqual(expected);
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: true });

		expect(h.coordinator.retry()).toBeNull();
		await flush();
		expect(chooseAction).toHaveBeenCalledTimes(1);
		expect(chooseAction.mock.calls[0][0].policy).toEqual(expected.policy);
		expect(saved.round.attempts).toBe(6);
		expect(saved.round.tokens).toBe(10_105);
	});

	it('does not restore retry eligibility when unavailable turns have exhausted their quota', async () => {
		const saved = botTurn({
			status: 'error',
			failure: 'unavailable',
			attempts: 3,
			tokens: 10_000,
		});
		const h = tracked({ turn: saved, limits: { roundMaxAttempts: 3 } });
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		expect(h.coordinator.retry()).not.toBeNull();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(saved.round.attempts).toBe(3);
		expect(saved.round.tokens).toBe(10_000);
	});

	it('leaves an exhausted restored round paused until the operator raises its allowance', async () => {
		const saved = JSON.parse(
			JSON.stringify(botTurn({ status: 'exhausted', failure: 'round_budget', attempts: 3 })),
		) as BotTurn;
		const h = tracked({ turn: saved, limits: { roundMaxAttempts: 3 } });
		h.coordinator.start();
		await flush();
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(h.coordinator.status()).toMatchObject({ status: 'exhausted', canRetry: false });
		expect(h.coordinator.retry()).not.toBeNull();
		h.runtime.limits.roundMaxAttempts = 4;
		expect(h.coordinator.status()).toMatchObject({ status: 'exhausted', canRetry: true });
		expect(h.coordinator.retry()).toBeNull();
		await flush();
		expect(h.chooseAction).toHaveBeenCalledTimes(1);
	});

	it.each([
		{ attempts: 3, tokens: 0 },
		{ attempts: 0, tokens: 10_000 },
	])('does not offer retry for a failed turn with exhausted allowance: %j', async (used) => {
		const h = tracked({
			turn: botTurn({ status: 'error', failure: 'timeout', ...used }),
			limits: { roundMaxAttempts: 3, roundMaxTokens: 10_000 },
		});
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ canRetry: false });
		expect(h.coordinator.retry()).not.toBeNull();
		expect(h.chooseAction).not.toHaveBeenCalled();
	});
	it('pauses oversized v2 history without spending budget or dropping evidence', async () => {
		const turn = botTurn();
		turn.gameData.tilePositions = { own: { x: 10, y: 10, z: 1 }, other: { x: 10, y: 10, z: 1 } };
		turn.round.version = 2;
		turn.round.pendingClues = [];
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		for (let index = 0; index < 2500; index += 1) {
			const before = turn.gameData.tilePositions;
			turn.gameData.tilePositions = { ...before, own: { x: index % 2 ? 10 : 60, y: 75, z: 1 } };
			turn.round.history = appendBotArrangement(turn.round.history, 'bot', before, turn.gameData);
		}
		const history = structuredClone(turn.round.history);
		expect(Buffer.byteLength(JSON.stringify(history))).toBeGreaterThan(MAX_BOT_INPUT_BYTES);
		const h = tracked({ turn });
		h.coordinator.start();
		await flush();
		expect(h.coordinator.status()).toMatchObject({ status: 'error', canRetry: false });
		expect(turn.round).toMatchObject({ failure: 'input_too_large', attempts: 0, tokens: 0 });
		expect(h.chooseAction).not.toHaveBeenCalled();
		expect(turn.round.history).toEqual(history);
	});

	it('dispatches off-turn clue responses only through the arrangement hook', async () => {
		const turn = botTurn();
		turn.gameData.currentPlayerId = 'human';
		turn.round.version = 2;
		turn.round.pendingClues = [{ playerId: 'bot', eventIds: ['event-1'] }];
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		turn.opportunity = 'clue';
		turn.sourceClueEventIds = ['event-1'];
		const decision = {
			actionId: null,
			arrangement: null,
			explanation: 'I will leave my cards in place.',
			notes: null,
		};
		const chooseAction = vi.fn<BotDecisionProvider['chooseAction']>().mockResolvedValue(decision);
		let active: BotTurn | null = turn;
		const apply = vi.fn();
		const applyClueResponse = vi.fn(() => {
			active = null;
			return null;
		});
		const coordinator = new BotTurnCoordinator(
			new BotRuntime({ chooseAction }, turn.round.policy),
			{
				gameId: 'clue-game',
				getTurn: () => active,
				persist: () => Promise.resolve(),
				notify: vi.fn(),
				apply,
				applyClueResponse,
			},
		);
		coordinators.push(coordinator);
		coordinator.start();
		await flush();
		expect(chooseAction.mock.calls[0][0]).toMatchObject({
			opportunity: 'clue',
			sourceClueEventIds: ['event-1'],
			legalActions: [],
		});
		expect(apply).not.toHaveBeenCalled();
		expect(applyClueResponse).toHaveBeenCalledExactlyOnceWith('bot', decision, ['event-1']);
		expect(coordinator.status()).toBeNull();
	});

	it('rejects malformed v2 pending queues and mixed policy/history contracts without throwing', () => {
		const turn = botTurn();
		const round: BotRound = {
			...turn.round,
			version: 2,
			policy: createRoundBotPolicy(turn.round.policy, turn.gameData),
			history: createBotHistory(turn.gameData, 2),
			pendingClues: [],
		};
		expect(isBotRound(round)).toBe(true);
		for (const pendingClues of [
			[null],
			[{}],
			[{ playerId: 'bot', eventIds: [] }],
			[{ playerId: 'bot', eventIds: ['e', 'e'] }],
			[
				{ playerId: 'bot', eventIds: ['e'] },
				{ playerId: 'bot', eventIds: ['f'] },
			],
		]) {
			expect(isBotRound({ ...round, pendingClues })).toBe(false);
		}
		expect(isBotRound({ ...round, history: createBotHistory(turn.gameData) })).toBe(false);
		expect(isBotRound({ ...round, policy: turn.round.policy })).toBe(false);
	});
	it('supplies only the receiving bot notepad as a detached request snapshot', async () => {
		const turn = botTurn();
		turn.round.version = 2;
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		const checkpoint = { eventId: 'initial', sequence: 0, turnIndex: 0 };
		const entry = {
			decisionId: 'prior-decision',
			opportunity: 'clue' as const,
			observedAt: checkpoint,
			recordedAt: checkpoint,
			sourceClueEventIds: [],
			explanation: 'Leave this card in place.',
			notes: 'A tentative play signal, not a confirmed identity.',
		};
		turn.round.notepads = {
			bot: { version: 1, entries: [entry] },
			anotherBot: { version: 1, entries: [{ ...entry, notes: 'Another seat private note' }] },
		};
		const pending = deferred<BotDecision>();
		const h = tracked({
			turn,
			provider: {
				chooseAction: vi
					.fn()
					.mockImplementation((request: Parameters<BotDecisionProvider['chooseAction']>[0]) => {
						expect(request.notepad).toEqual(turn.round.notepads!.bot);
						expect(JSON.stringify(request)).not.toContain('Another seat private note');
						request.notepad!.entries[0].notes = 'Mutating a request cannot rewrite durable memory';
						return pending.promise;
					}),
			},
		});
		h.coordinator.start();
		await flush();
		expect(turn.round.notepads.bot.entries[0].notes).toBe(
			'A tentative play signal, not a confirmed identity.',
		);
	});

	it('counts the complete private notepad against the request limit without truncating it', async () => {
		const turn = botTurn();
		turn.round.version = 2;
		turn.round.policy = createRoundBotPolicy(turn.round.policy, turn.gameData);
		turn.round.history = createBotHistory(turn.gameData, 2);
		const checkpoint = { eventId: 'initial', sequence: 0, turnIndex: 0 };
		turn.round.notepads = {
			bot: {
				version: 1,
				entries: Array.from({ length: 70 }, (_, index) => ({
					decisionId: `note-${index}`,
					opportunity: 'turn',
					observedAt: checkpoint,
					recordedAt: checkpoint,
					sourceClueEventIds: [],
					explanation: 'A recorded decision summary.',
					notes: 'x'.repeat(8000),
				})),
			},
		};
		const h = tracked({ turn });
		h.coordinator.start();
		await flush();
		expect(turn.round).toMatchObject({ failure: 'input_too_large', attempts: 0 });
		expect(turn.round.notepads.bot.entries).toHaveLength(70);
		expect(h.chooseAction).not.toHaveBeenCalled();
	});
});
