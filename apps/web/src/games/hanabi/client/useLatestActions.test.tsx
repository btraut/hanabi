// @vitest-environment happy-dom

import {
	generateHanabiGameData,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiStage,
} from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HanabiGameContextProvider } from './HanabiGameContext';
import { HanabiGameStore } from './HanabiGameStore';
import useActionSounds from './useActionSounds';
import useJustTookAction from './useJustTookAction';
import { useLatestActionEffect, useLatestTileAction } from './useLatestActions';

vi.mock('~/components/SocketContext', () => ({ useUserId: () => 'alice' }));

function discard(id: string): HanabiGameAction {
	return {
		id,
		type: HanabiGameActionType.Discard,
		playerId: 'alice',
		tile: { id: `tile-${id}`, color: 'red', number: 1 },
	};
}

describe('gameplay action subscriptions', () => {
	let root: Root;
	let store: HanabiGameStore;
	const onAction = vi.fn();
	const playAudio = vi.fn<() => Promise<void>>();

	function Probe() {
		const action = useLatestTileAction();
		const animating = useJustTookAction();
		useLatestActionEffect(onAction);
		useActionSounds();
		return <div data-action={action?.id ?? ''} data-animating={String(animating)} />;
	}

	beforeEach(() => {
		vi.useFakeTimers();
		playAudio.mockReset().mockResolvedValue();
		vi.stubGlobal(
			'Audio',
			class {
				play = playAudio;
			},
		);
		(
			globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
		).IS_REACT_ACT_ENVIRONMENT = true;
		document.body.innerHTML = '<div id="mount"></div>';
		root = createRoot(document.querySelector('#mount')!);
		onAction.mockClear();
	});
	afterEach(() => {
		act(() => root.unmount());
		vi.useRealTimers();
		vi.unstubAllGlobals();
		document.body.innerHTML = '';
	});

	function render(actions: HanabiGameAction[]) {
		store = new HanabiGameStore(generateHanabiGameData({ stage: HanabiStage.Playing, actions }));
		act(() =>
			root.render(
				<HanabiGameContextProvider
					value={{ store, code: 'test', gameMessenger: null, create: vi.fn(), watch: vi.fn() }}
				>
					<Probe />
				</HanabiGameContextProvider>,
			),
		);
	}

	function publish(actions: readonly HanabiGameAction[]) {
		act(() => store.receive({ ...store.game.getSnapshot()!, actions }));
	}
	function latest() {
		return document.querySelector('[data-action]')!;
	}

	it('does not replay the initial log, and expires effects after a new action', () => {
		render([discard('old')]);
		expect(latest().getAttribute('data-action')).toBe('');
		expect(latest().getAttribute('data-animating')).toBe('false');
		expect(playAudio).not.toHaveBeenCalled();
		publish([...store.game.getSnapshot()!.actions, discard('new')]);
		expect(latest().getAttribute('data-action')).toBe('new');
		expect(latest().getAttribute('data-animating')).toBe('true');
		expect(playAudio).toHaveBeenCalledOnce();
		act(() => {
			vi.advanceTimersByTime(200);
		});
		expect(latest().getAttribute('data-animating')).toBe('false');
	});

	it('ignores chat and duplicate snapshots without extending a movement effect', () => {
		render([discard('old')]);
		publish([...store.game.getSnapshot()!.actions, discard('new')]);
		act(() => {
			vi.advanceTimersByTime(150);
		});
		const calls = onAction.mock.calls.length;
		publish([
			...store.game.getSnapshot()!.actions,
			{ id: 'chat', type: HanabiGameActionType.Chat, playerId: 'alice', message: 'Hello' },
		]);
		publish(JSON.parse(JSON.stringify(store.game.getSnapshot()!.actions)) as HanabiGameAction[]);
		expect(onAction).toHaveBeenCalledTimes(calls);
		expect(playAudio).toHaveBeenCalledOnce();
		act(() => {
			vi.advanceTimersByTime(50);
		});
		expect(latest().getAttribute('data-animating')).toBe('false');
	});

	it('detects a new action when a full retained gameplay queue keeps the same length', () => {
		render(Array.from({ length: 1000 }, (_, index) => discard(`old-${index}`)));
		publish([...store.game.getSnapshot()!.actions.slice(1), discard('new')]);
		expect(latest().getAttribute('data-action')).toBe('new');
		expect(latest().getAttribute('data-animating')).toBe('true');
		expect(playAudio).toHaveBeenCalledOnce();
	});

	it('does not replay multiple missed turns or a replacement round log', () => {
		render([discard('old')]);
		publish([...store.game.getSnapshot()!.actions, discard('missed-1'), discard('missed-2')]);
		expect(latest().getAttribute('data-action')).toBe('');
		expect(playAudio).not.toHaveBeenCalled();
		publish([discard('replacement')]);
		expect(latest().getAttribute('data-action')).toBe('');
		expect(latest().getAttribute('data-animating')).toBe('false');
		expect(playAudio).not.toHaveBeenCalled();
		publish([discard('replacement'), discard('next')]);
		expect(latest().getAttribute('data-action')).toBe('next');
		expect(playAudio).toHaveBeenCalledOnce();
	});
});
