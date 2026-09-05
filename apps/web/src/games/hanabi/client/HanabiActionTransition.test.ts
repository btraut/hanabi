import {
	getNewTileActionId,
	getTileViewTransitionName,
	HanabiActionTransitionCoordinator,
} from './HanabiActionTransition';
import { HanabiGameActionType, HanabiStage } from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';

type TestAction = {
	id: string;
	type: HanabiGameActionType;
	tile?: { id: string };
};

type TestState = {
	actions: readonly TestAction[];
	positions?: readonly { tileId: string; x: number }[];
	notes?: string;
	stage?: HanabiStage;
	seed?: string;
};

function action(id: string, type: HanabiGameActionType, tileId?: string): TestAction {
	return { id, type, tile: tileId ? { id: tileId } : undefined };
}

function state(...actions: TestAction[]): TestState {
	return { actions };
}

function deferred(): { promise: Promise<void>; resolve: () => void; reject: () => void } {
	let resolve!: () => void;
	let reject!: () => void;
	const promise = new Promise<void>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}

describe('getNewTileActionId', () => {
	it.each([HanabiGameActionType.Play, HanabiGameActionType.Discard])(
		'detects one appended %s action',
		(type) => {
			const previous = [action('started', HanabiGameActionType.GameStarted)];
			const next = [...previous, action('tile-action', type, 'tile-1')];

			expect(getNewTileActionId(previous, next)).toBe('tile-1');
		},
	);

	it('detects a tile action followed by bookkeeping actions in the same refresh', () => {
		const previous = [action('started', HanabiGameActionType.GameStarted)];
		const next = [
			...previous,
			action('played', HanabiGameActionType.Play, 'tile-1'),
			action('clock', HanabiGameActionType.ShotClockStarted),
			action('finished', HanabiGameActionType.GameFinished),
		];

		expect(getNewTileActionId(previous, next)).toBe('tile-1');
	});

	it('ignores appended actions that do not move a tile', () => {
		const previous = [action('started', HanabiGameActionType.GameStarted)];
		const next = [...previous, action('clue', HanabiGameActionType.GiveNumberClue)];

		expect(getNewTileActionId(previous, next)).toBeNull();
	});

	it('detects one play when the oldest action leaves a capped 1000-action history', () => {
		const previous = Array.from({ length: 1000 }, (_, index) =>
			action(`prior-${index}`, HanabiGameActionType.GiveNumberClue),
		);
		const next = [...previous.slice(1), action('played', HanabiGameActionType.Play, 'tile-1')];

		expect(next).toHaveLength(previous.length);
		expect(getNewTileActionId(previous, next)).toBe('tile-1');
	});

	it('skips reconnect batches in a shifted bounded history', () => {
		const previous = Array.from({ length: 1000 }, (_, index) =>
			action(`prior-${index}`, HanabiGameActionType.GiveNumberClue),
		);
		const next = [
			...previous.slice(2),
			action('played', HanabiGameActionType.Play, 'tile-1'),
			action('discarded', HanabiGameActionType.Discard, 'tile-2'),
		];

		expect(getNewTileActionId(previous, next)).toBeNull();
	});

	it('rejects an inconsistent overlap even when the last prior action appears', () => {
		const previous = [
			action('started', HanabiGameActionType.GameStarted),
			action('clue-1', HanabiGameActionType.GiveNumberClue),
			action('clue-2', HanabiGameActionType.GiveNumberClue),
		];
		const next = [
			action('different-clue', HanabiGameActionType.GiveNumberClue),
			previous[2],
			action('played', HanabiGameActionType.Play, 'tile-1'),
		];

		expect(getNewTileActionId(previous, next)).toBeNull();
	});

	it('does not animate a new round appended to a retained history', () => {
		const previous = [action('finished', HanabiGameActionType.GameFinished)];
		const next = [
			...previous,
			action('started', HanabiGameActionType.GameStarted),
			action('played', HanabiGameActionType.Play, 'tile-1'),
		];

		expect(getNewTileActionId(previous, next)).toBeNull();
		expect(getNewTileActionId([], next)).toBeNull();
	});

	it('does not replay hydrated, reset, or replaced action histories', () => {
		const hydrated = [
			action('started', HanabiGameActionType.GameStarted),
			action('played', HanabiGameActionType.Play, 'tile-1'),
		];

		expect(getNewTileActionId(hydrated, hydrated)).toBeNull();
		expect(getNewTileActionId(hydrated, [])).toBeNull();
		expect(
			getNewTileActionId(hydrated, [
				action('different-start', HanabiGameActionType.GameStarted),
				action('different-play', HanabiGameActionType.Play, 'tile-2'),
				action('different-discard', HanabiGameActionType.Discard, 'tile-3'),
			]),
		).toBeNull();
	});

	it('skips batched tile actions that have no reliable intermediate DOM', () => {
		const previous = [action('started', HanabiGameActionType.GameStarted)];
		const next = [
			...previous,
			action('played-1', HanabiGameActionType.Play, 'tile-1'),
			action('played-2', HanabiGameActionType.Play, 'tile-2'),
		];

		expect(getNewTileActionId(previous, next)).toBeNull();
	});
});

describe('HanabiActionTransitionCoordinator', () => {
	function setup({ reducedMotion = false, supported = true } = {}) {
		const applied: Array<{ state: TestState; tileId: string | null }> = [];
		const marked: string[] = [];
		let cleared = 0;
		const transitions: Array<{
			update: () => void;
			ready: ReturnType<typeof deferred>;
			readyCatch: ReturnType<typeof vi.spyOn>;
			finished: ReturnType<typeof deferred>;
			skipTransition: ReturnType<typeof vi.fn>;
		}> = [];

		const coordinator = new HanabiActionTransitionCoordinator<TestState>({
			applyState: (nextState, tileId) => applied.push({ state: nextState, tileId }),
			markTransitioningTile: (tileId) => marked.push(tileId),
			clearTransitioningTile: () => {
				cleared += 1;
			},
			prefersReducedMotion: () => reducedMotion,
			startTransition: supported
				? (update) => {
						const ready = deferred();
						const readyCatch = vi.spyOn(ready.promise, 'catch');
						const finished = deferred();
						const skipTransition = vi.fn();
						transitions.push({ update, ready, readyCatch, finished, skipTransition });
						return { ready: ready.promise, finished: finished.promise, skipTransition };
					}
				: undefined,
		});

		return {
			coordinator,
			applied,
			marked,
			transitions,
			get cleared() {
				return cleared;
			},
		};
	}

	it('commits eligible actions inside the transition callback and clears after finishing', async () => {
		const harness = setup();
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const played = state(...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1'));

		harness.coordinator.update(initial);
		harness.coordinator.update(played);

		expect(harness.marked).toEqual(['tile-1']);
		expect(harness.applied).toEqual([{ state: initial, tileId: null }]);

		harness.transitions[0].update();
		expect(harness.applied.at(-1)).toEqual({ state: played, tileId: 'tile-1' });

		harness.transitions[0].finished.resolve();
		await harness.transitions[0].finished.promise;
		await Promise.resolve();
		expect(harness.cleared).toBe(1);
	});

	it.each([
		{ label: 'reduced motion', options: { reducedMotion: true } },
		{ label: 'an unsupported browser', options: { supported: false } },
	])('updates immediately for $label', ({ options }) => {
		const harness = setup(options);
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const discarded = state(
			...initial.actions,
			action('discarded', HanabiGameActionType.Discard, 'tile-1'),
		);

		harness.coordinator.update(initial);
		harness.coordinator.update(discarded);

		expect(harness.transitions).toHaveLength(0);
		expect(harness.applied.at(-1)).toEqual({ state: discarded, tileId: null });
	});

	it.each([HanabiGameActionType.Play, HanabiGameActionType.Discard])(
		'preserves a pending %s animation through position and note refreshes',
		(type) => {
			const harness = setup();
			const initial = state(action('started', HanabiGameActionType.GameStarted));
			const played = state(...initial.actions, action('played', type, 'tile-1'));
			const arranged = { ...played, positions: [{ tileId: 'tile-2', x: 100 }] };
			const annotated = { ...arranged, notes: 'Save tile-2' };
			harness.coordinator.update(initial);
			harness.coordinator.update(played);
			harness.coordinator.update(arranged);
			harness.coordinator.update(annotated);

			expect(harness.transitions[0].skipTransition).not.toHaveBeenCalled();
			expect(harness.applied).toEqual([{ state: initial, tileId: null }]);
			harness.transitions[0].update();
			expect(harness.applied.at(-1)).toEqual({ state: annotated, tileId: 'tile-1' });
			expect(harness.transitions).toHaveLength(1);
		},
	);

	it('applies position and note refreshes during the slide without removing its tile identity', async () => {
		const harness = setup();
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const played = state(...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1'));
		harness.coordinator.update(initial);
		harness.coordinator.update(played);
		harness.transitions[0].update();

		const arranged = { ...played, positions: [{ tileId: 'tile-2', x: 100 }] };
		const annotated = { ...arranged, notes: 'Save tile-2' };
		harness.coordinator.update(arranged);
		harness.coordinator.update(annotated);
		expect(harness.transitions[0].skipTransition).not.toHaveBeenCalled();
		expect(harness.applied.at(-1)).toEqual({ state: annotated, tileId: 'tile-1' });
		harness.transitions[0].finished.resolve();
		await harness.transitions[0].finished.promise;
		await Promise.resolve();
		expect(harness.cleared).toBe(1);
		harness.coordinator.update({ ...annotated, notes: '' });
		expect(harness.applied.at(-1)?.tileId).toBeNull();
		expect(harness.transitions).toHaveLength(1);
	});

	it('never lets a delayed callback overwrite a newer gameplay action', () => {
		const harness = setup();
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const played = state(...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1'));
		const arranged = { ...played, positions: [{ tileId: 'tile-2', x: 100 }] };
		const clued = state(...arranged.actions, action('clue', HanabiGameActionType.GiveNumberClue));

		harness.coordinator.update(initial);
		harness.coordinator.update(played);
		harness.coordinator.update(arranged);
		harness.coordinator.update(clued);
		harness.transitions[0].update();

		expect(harness.transitions[0].skipTransition).toHaveBeenCalledOnce();
		expect(harness.applied.at(-1)).toEqual({ state: clued, tileId: null });
		expect(harness.applied).not.toContainEqual({ state: played, tileId: 'tile-1' });
	});

	it.each([
		{ label: 'reset', replacement: state() },
		{
			label: 'replaced history',
			replacement: state(action('another-game', HanabiGameActionType.GameStarted)),
		},
	])('cancels a pending slide on $label', ({ replacement }) => {
		const harness = setup();
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const played = state(...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1'));
		harness.coordinator.update(initial);
		harness.coordinator.update(played);
		harness.coordinator.update({ ...played, notes: 'Save tile-2' });
		harness.coordinator.update(replacement);
		harness.transitions[0].update();
		expect(harness.transitions[0].skipTransition).toHaveBeenCalledOnce();
		expect(harness.applied.at(-1)).toEqual({ state: replacement, tileId: null });
	});

	it('animates a play after a capped gameplay history shifts', () => {
		const harness = setup();
		const initial = state(
			...Array.from({ length: 1000 }, (_, index) =>
				action(`prior-${index}`, HanabiGameActionType.GiveNumberClue),
			),
		);
		const played = state(
			...initial.actions.slice(1),
			action('played', HanabiGameActionType.Play, 'tile-1'),
		);
		harness.coordinator.update(initial);
		harness.coordinator.update(played);

		expect(harness.transitions).toHaveLength(1);
		expect(harness.applied).toEqual([{ state: initial, tileId: null }]);
		harness.transitions[0].update();
		expect(harness.applied.at(-1)).toEqual({ state: played, tileId: 'tile-1' });
	});

	it.each(['setup', 'new round'] as const)(
		'cancels a pending slide on %s when live seeds are empty',
		(boundary) => {
			const harness = setup();
			const initial: TestState = {
				...state(action('started', HanabiGameActionType.GameStarted)),
				stage: HanabiStage.Playing,
				seed: '',
			};
			const played = {
				...initial,
				actions: [...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1')],
			};
			const replacement =
				boundary === 'setup'
					? { ...played, stage: HanabiStage.Setup }
					: {
							...played,
							actions: [
								...played.actions,
								action('next-round', HanabiGameActionType.GameStarted),
								action('next-play', HanabiGameActionType.Play, 'tile-2'),
							],
						};

			harness.coordinator.update(initial);
			harness.coordinator.update(played);
			harness.coordinator.update(replacement);
			harness.transitions[0].update();

			expect(harness.transitions).toHaveLength(1);
			expect(harness.transitions[0].skipTransition).toHaveBeenCalledOnce();
			expect(harness.applied.at(-1)).toEqual({ state: replacement, tileId: null });
		},
	);

	it('keeps a newer tile transition when the canceled one finishes', async () => {
		const harness = setup();
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const played = state(...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1'));
		const discarded = state(
			...played.actions,
			action('discarded', HanabiGameActionType.Discard, 'tile-2'),
		);
		harness.coordinator.update(initial);
		harness.coordinator.update(played);
		harness.transitions[0].update();
		harness.coordinator.update(discarded);
		harness.transitions[0].finished.resolve();
		await harness.transitions[0].finished.promise;
		await Promise.resolve();
		expect(harness.cleared).toBe(0);
		const arranged = { ...discarded, positions: [{ tileId: 'tile-3', x: 100 }] };
		harness.coordinator.update(arranged);
		harness.transitions[1].update();
		expect(harness.applied.at(-1)).toEqual({ state: arranged, tileId: 'tile-2' });
		expect(harness.transitions[1].skipTransition).not.toHaveBeenCalled();
	});

	it('observes transition rejections and skips active work during cleanup', async () => {
		const harness = setup();
		const initial = state(action('started', HanabiGameActionType.GameStarted));
		const played = state(...initial.actions, action('played', HanabiGameActionType.Play, 'tile-1'));

		harness.coordinator.update(initial);
		harness.coordinator.update(played);
		expect(harness.transitions[0].readyCatch).toHaveBeenCalledOnce();

		harness.transitions[0].ready.reject();
		harness.transitions[0].finished.reject();
		await Promise.resolve();
		await Promise.resolve();
		expect(harness.cleared).toBe(1);

		const discarded = state(
			...played.actions,
			action('discarded', HanabiGameActionType.Discard, 'tile-2'),
		);
		harness.coordinator.update(discarded);
		harness.coordinator.cleanUp();

		harness.transitions[1].update();
		expect(harness.transitions[1].skipTransition).toHaveBeenCalledOnce();
		expect(harness.applied).toEqual([{ state: initial, tileId: null }]);
	});
});

describe('getTileViewTransitionName', () => {
	it('prefixes tile UUIDs with a valid stable custom identifier', () => {
		expect(getTileViewTransitionName('25a4b712-e049-4dba-b218-52bb71b10dd1')).toBe(
			'hanabi-tile-25a4b712-e049-4dba-b218-52bb71b10dd1',
		);
	});
});
