// @vitest-environment happy-dom

import {
	generateHanabiGameData,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
} from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HanabiActionTransitionCoordinator } from './HanabiActionTransition';
import HanabiBoardPresentation from './HanabiBoardPresentation';
import {
	HanabiGameContextProvider,
	useActivityData,
	useBoardData,
	useBotStatusData,
	useGameData,
	useTransitioningTileId,
} from './HanabiGameContext';
import { HanabiGameStore } from './HanabiGameStore';

function initialGame(): HanabiGameData {
	return generateHanabiGameData({
		seed: '',
		stage: HanabiStage.Playing,
		players: {
			alice: { id: 'alice', name: 'Alice', connected: true },
			bot: { id: 'bot', name: 'Ember', connected: false, kind: 'bot' },
		},
		currentPlayerId: 'bot',
		turnOrder: ['alice', 'bot'],
		tiles: {
			one: { id: 'one', color: 'red', number: 1 },
			two: { id: 'two', color: 'red', number: 2 },
		},
		playerTiles: { alice: [], bot: ['one', 'two'] },
		actions: [{ id: 'start', type: HanabiGameActionType.GameStarted, startingPlayerId: 'bot' }],
		bots: { available: true, canManage: false, turn: null },
	});
}

function play(initial: HanabiGameData): HanabiGameData {
	return {
		...initial,
		currentPlayerId: 'alice',
		playedTiles: ['one'],
		playerTiles: { ...initial.playerTiles, bot: ['two'] },
		actions: [
			...initial.actions,
			{
				id: 'play-one',
				type: HanabiGameActionType.Play,
				playerId: 'bot',
				tile: initial.tiles.one,
				valid: true,
				remainingLives: 3,
			},
		],
	};
}

function withChat(game: HanabiGameData): HanabiGameData {
	return {
		...game,
		actions: [
			...game.actions,
			{
				id: 'debug',
				type: HanabiGameActionType.Chat,
				playerId: 'bot',
				message: 'Debug: Play the one.',
			},
		],
	};
}

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((finish) => {
		resolve = finish;
	});
	return { promise, resolve };
}

type CapturedTransition = {
	update: () => void;
	ready: ReturnType<typeof deferred>;
	finished: ReturnType<typeof deferred>;
	skipTransition: ReturnType<typeof vi.fn>;
};

describe('board presentation subscriptions', () => {
	let root: Root | null;
	let transitions: CapturedTransition[];
	let reducedMotion: boolean;

	beforeEach(() => {
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		transitions = [];
		reducedMotion = false;
		vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({
			matches: reducedMotion,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		}));
		Object.defineProperty(document, 'startViewTransition', {
			configurable: true,
			value: (update: () => void) => {
				const captured = {
					update,
					ready: deferred(),
					finished: deferred(),
					skipTransition: vi.fn(),
				};
				transitions.push(captured);
				return {
					ready: captured.ready.promise,
					finished: captured.finished.promise,
					skipTransition: captured.skipTransition,
				};
			},
		});
	});

	afterEach(() => {
		act(() => root?.unmount());
		document.body.innerHTML = '';
		Reflect.deleteProperty(document, 'startViewTransition');
		vi.restoreAllMocks();
	});

	function mount(initial = initialGame()) {
		const store = new HanabiGameStore(initial);
		const renders = { board: 0, tile: 0, activity: 0, bots: 0, authoritative: 0 };
		function BoardProbe() {
			renders.board += 1;
			const board = useBoardData();
			return (
				<output id="board">
					{board.stage}:{board.playedTiles.join(',')}
				</output>
			);
		}
		function TileProbe() {
			renders.tile += 1;
			return <output id="tile">{useTransitioningTileId() ?? 'none'}</output>;
		}
		function ActivityProbe() {
			renders.activity += 1;
			return (
				<output id="activity">
					{useActivityData()
						.actions.map((action) => action.id)
						.join(',')}
				</output>
			);
		}
		function BotProbe() {
			renders.bots += 1;
			return <output id="bots">{useBotStatusData().bots?.turn?.status ?? 'idle'}</output>;
		}
		function AuthoritativeProbe() {
			renders.authoritative += 1;
			return <output id="authoritative">{useGameData().playedTiles.join(',')}</output>;
		}
		act(() =>
			root!.render(
				<HanabiGameContextProvider
					value={{
						store,
						gameMessenger: null,
						code: 'test',
						create: () => Promise.resolve('test'),
						watch: () => Promise.resolve(),
					}}
				>
					<HanabiBoardPresentation>
						<BoardProbe />
						<TileProbe />
						<ActivityProbe />
						<BotProbe />
						<AuthoritativeProbe />
					</HanabiBoardPresentation>
				</HanabiGameContextProvider>,
			),
		);
		return {
			store,
			renders,
			receive: (next: HanabiGameData) =>
				act(() => store.receive(JSON.parse(JSON.stringify(next)) as HanabiGameData)),
		};
	}

	function text(id: string) {
		return document.querySelector(`#${id}`)?.textContent;
	}

	it('shows chat and bot status immediately while a play waits for its board capture', async () => {
		const coordinatorUpdate = vi.spyOn(HanabiActionTransitionCoordinator.prototype, 'update');
		const initial = initialGame();
		const harness = mount(initial);
		const played = play(initial);
		harness.receive(played);
		expect(text('authoritative')).toBe('one');
		expect(text('board')).toBe('Playing:');
		expect(text('tile')).toBe('one');
		expect(transitions).toHaveLength(1);
		const before = { ...harness.renders };
		const updateCount = coordinatorUpdate.mock.calls.length;

		const chatted = withChat(played);
		harness.receive(chatted);
		expect(text('activity')).toBe('start,play-one,debug');
		expect(harness.renders.activity).toBeGreaterThan(before.activity);
		expect(harness.renders.bots).toBe(before.bots);
		const thinking = {
			...chatted,
			bots: {
				...chatted.bots!,
				turn: { playerId: 'bot', status: 'thinking' as const, canRetry: false },
			},
		};
		harness.receive(thinking);
		expect(text('bots')).toBe('thinking');
		expect(harness.store.game.getSnapshot()).toEqual(thinking);
		expect(harness.renders.board).toBe(before.board);
		expect(harness.renders.tile).toBe(before.tile);
		expect(coordinatorUpdate).toHaveBeenCalledTimes(updateCount);
		expect(transitions[0].skipTransition).not.toHaveBeenCalled();

		act(() => transitions[0].update());
		expect(text('board')).toBe('Playing:one');
		expect(text('tile')).toBe('one');
		await act(async () => {
			transitions[0].finished.resolve();
			await transitions[0].finished.promise;
		});
		expect(text('tile')).toBe('none');
	});

	it('keeps the active board and tile subscriptions quiet for chat and bot updates mid-animation', () => {
		const coordinatorUpdate = vi.spyOn(HanabiActionTransitionCoordinator.prototype, 'update');
		const initial = initialGame();
		const harness = mount(initial);
		const played = play(initial);
		harness.receive(played);
		act(() => transitions[0].update());
		const before = { ...harness.renders };
		const updateCount = coordinatorUpdate.mock.calls.length;
		const next = withChat({
			...played,
			bots: { ...played.bots!, turn: { playerId: 'bot', status: 'thinking', canRetry: false } },
		});
		harness.receive(next);

		expect(text('activity')).toContain('debug');
		expect(text('bots')).toBe('thinking');
		expect(text('board')).toBe('Playing:one');
		expect(text('tile')).toBe('one');
		expect(harness.renders.board).toBe(before.board);
		expect(harness.renders.tile).toBe(before.tile);
		expect(coordinatorUpdate).toHaveBeenCalledTimes(updateCount);
		expect(transitions).toHaveLength(1);
		expect(transitions[0].skipTransition).not.toHaveBeenCalled();
	});

	it('ignores delayed animation callbacks after a same-seed reset', async () => {
		const initial = initialGame();
		const harness = mount(initial);
		harness.receive(play(initial));
		harness.receive({ ...initial, stage: HanabiStage.Setup, currentPlayerId: null, actions: [] });
		expect(transitions[0].skipTransition).toHaveBeenCalledOnce();
		expect(text('board')).toBe('Setup:');
		expect(text('tile')).toBe('none');
		act(() => transitions[0].update());
		await act(async () => {
			transitions[0].finished.resolve();
			await transitions[0].finished.promise;
		});
		expect(text('board')).toBe('Setup:');
		expect(text('tile')).toBe('none');
	});

	it('unsubscribes and ignores deferred work after the board unmounts', async () => {
		const coordinatorUpdate = vi.spyOn(HanabiActionTransitionCoordinator.prototype, 'update');
		const initial = initialGame();
		const harness = mount(initial);
		harness.receive(play(initial));
		act(() => root!.unmount());
		root = null;
		const before = { ...harness.renders };
		const updateCount = coordinatorUpdate.mock.calls.length;
		expect(transitions[0].skipTransition).toHaveBeenCalledOnce();
		act(() => transitions[0].update());
		await act(async () => {
			transitions[0].finished.resolve();
			await transitions[0].finished.promise;
		});
		harness.receive({ ...initial, stage: HanabiStage.Setup, actions: [] });
		expect(harness.renders).toEqual(before);
		expect(coordinatorUpdate).toHaveBeenCalledTimes(updateCount);
		expect(document.querySelector('#board')).toBeNull();
	});

	it.each(['reduced motion', 'unsupported browser'])(
		'applies board changes immediately with %s',
		(mode) => {
			if (mode === 'reduced motion') reducedMotion = true;
			else Reflect.deleteProperty(document, 'startViewTransition');
			const initial = initialGame();
			const harness = mount(initial);
			harness.receive(withChat(play(initial)));
			expect(text('board')).toBe('Playing:one');
			expect(text('authoritative')).toBe('one');
			expect(text('activity')).toContain('debug');
			expect(text('tile')).toBe('none');
			expect(transitions).toHaveLength(0);
		},
	);

	it('shows a reconnect containing multiple missed moves without replaying a partial animation', () => {
		const initial = initialGame();
		const harness = mount(initial);
		const played = play(initial);
		harness.receive(
			withChat({
				...played,
				playedTiles: ['one', 'two'],
				playerTiles: { ...played.playerTiles, bot: [] },
				actions: [
					...played.actions,
					{
						id: 'play-two',
						type: HanabiGameActionType.Play,
						playerId: 'bot',
						tile: initial.tiles.two,
						valid: true,
						remainingLives: 3,
					},
				],
			}),
		);
		expect(text('board')).toBe('Playing:one,two');
		expect(text('authoritative')).toBe('one,two');
		expect(text('activity')).toBe('start,play-one,play-two,debug');
		expect(text('tile')).toBe('none');
		expect(transitions).toHaveLength(0);
	});
});
