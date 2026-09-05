// @vitest-environment happy-dom

import {
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
} from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import HanabiActionToasts, { HANABI_ACTION_TOAST_DURATION_MS } from './HanabiActionToasts';
import { getHanabiDesktopFixtures } from './dev/HanabiDesktopFixtures';

let root: Root;
let gameData: HanabiGameData;
let userId: string;
let serial = 0;
const toast = () => document.querySelector('.hanabi-action-toast');
const render = () =>
	act(() => root.render(<HanabiActionToasts gameData={gameData} userId={userId} />));
const advance = (ms = HANABI_ACTION_TOAST_DURATION_MS) => {
	act(() => {
		vi.advanceTimersByTime(ms);
	});
};
function append(...actions: HanabiGameAction[]) {
	gameData = { ...gameData, actions: [...gameData.actions, ...actions] };
	render();
}
function move(type: HanabiGameActionType): HanabiGameAction {
	const source = getHanabiDesktopFixtures().activity.gameData.actions.find(
		(action) => action.type === type,
	)!;
	return { ...source, id: `toast-${serial++}` };
}

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers();
	({ gameData, userId } = getHanabiDesktopFixtures().activity);
	document.body.innerHTML = '<div id="mount"></div>';
	root = createRoot(document.querySelector('#mount')!);
	render();
});
afterEach(() => {
	act(() => root.unmount());
	vi.useRealTimers();
	document.body.innerHTML = '';
});

it('baselines existing history and ignores chat and system events', () => {
	expect(toast()).toBeNull();
	append(move(HanabiGameActionType.Chat), {
		id: 'clock',
		playerId: userId,
		type: HanabiGameActionType.ShotClockTickedDown,
		remainingTurns: 2,
	});
	expect(toast()).toBeNull();
});

it('shows a color clue with actor, recipient and history formatting, then auto-dismisses', () => {
	append(move(HanabiGameActionType.GiveColorClue));
	expect(toast()?.textContent).toContain('BB-8 clued');
	expect(toast()?.textContent).toContain('You');
	expect(toast()?.textContent).toContain('Red clue');
	expect(toast()?.querySelector('.hanabi-feed-action-value')?.getAttribute('style')).toContain(
		'color:',
	);
	expect(document.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
	advance();
	expect(toast()).toBeNull();
});

it('queues consecutive actions without extending the first notification', () => {
	append(move(HanabiGameActionType.Play));
	advance(2000);
	append(move(HanabiGameActionType.Discard));
	expect(toast()?.textContent).toContain('played');
	advance(2000);
	expect(toast()?.textContent).toContain('discarded');
	advance();
	expect(toast()).toBeNull();
});

it('supports number clues, own moves and failed plays', () => {
	append({
		id: 'number-clue',
		type: HanabiGameActionType.GiveNumberClue,
		playerId: userId,
		recipientId: gameData.turnOrder[1],
		number: 3,
		tiles: [],
	});
	expect(toast()?.textContent).toContain('You clued');
	expect(toast()?.textContent).toContain('3 clue');
	advance();
	const action = move(HanabiGameActionType.Play);
	if (action.type !== HanabiGameActionType.Play) throw new Error('Expected play fixture');
	append({ ...action, valid: false });
	expect(toast()?.textContent).toContain('Invalid play');
});

it('dismisses manually and keeps later actions queued', () => {
	append(move(HanabiGameActionType.Play), move(HanabiGameActionType.Discard));
	act(() =>
		document
			.querySelector<HTMLButtonElement>('[aria-label="Dismiss action notification"]')!
			.click(),
	);
	expect(toast()?.textContent).toContain('discarded');
	advance();
	expect(toast()).toBeNull();
});

it('does not repeat actions after snapshot refresh or bounded history rollover', () => {
	const action = move(HanabiGameActionType.Play);
	append(action);
	advance();
	gameData = { ...gameData, actions: [...gameData.actions] };
	render();
	expect(toast()).toBeNull();
	gameData = { ...gameData, actions: [action, move(HanabiGameActionType.Discard)] };
	render();
	expect(toast()?.textContent).toContain('discarded');
	advance();
	expect(toast()).toBeNull();
});

it.each(['round', 'lobby', 'replacement'] as const)(
	'clears queued notifications on %s reset',
	(reset) => {
		append(move(HanabiGameActionType.Play), move(HanabiGameActionType.Discard));
		gameData = {
			...gameData,
			...(reset === 'round'
				? { seed: 'new-round' }
				: reset === 'lobby'
					? { stage: HanabiStage.Setup }
					: { actions: [move(HanabiGameActionType.Play)] }),
		};
		render();
		expect(toast()).toBeNull();
		advance();
		expect(toast()).toBeNull();
	},
);

it('still shows the final move when the game finishes', () => {
	gameData = { ...gameData, stage: HanabiStage.Finished };
	append(move(HanabiGameActionType.Play));
	expect(toast()?.textContent).toContain('played');
});
