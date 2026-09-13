// @vitest-environment happy-dom

import {
	generateHanabiGameData,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiStage,
} from '@hanabi/shared';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HanabiGameContextProvider } from './HanabiGameContext';
import { HanabiGameStore } from './HanabiGameStore';
import { useHanabiHighlightContext } from './HanabiHighlightContext';
import HanabiHighlightController from './HanabiHighlightController';
import useActionHighlighter from './useActionHighlighter';

vi.mock('~/components/SocketContext', () => ({ useUserId: () => 'recipient' }));

const tile = { id: 'tile-a', color: 'red', number: 3 } as const;
const clue: HanabiGameAction = {
	id: 'clue',
	type: HanabiGameActionType.GiveNumberClue,
	playerId: 'giver',
	recipientId: 'recipient',
	number: 3,
	tiles: [tile],
};

let root: Root;
let mount: HTMLDivElement;
let store: HanabiGameStore;

function HighlightProbe(): JSX.Element {
	useActionHighlighter();
	const { highlightedAction, highlightedLabel, highlightedTiles } = useHanabiHighlightContext();
	return (
		<output>
			{JSON.stringify({
				id: highlightedAction,
				label: highlightedLabel,
				tiles: [...highlightedTiles],
			})}
		</output>
	);
}

function selectedHighlight() {
	return JSON.parse(mount.querySelector('output')!.textContent) as {
		id: string | null;
		label: string | null;
		tiles: string[];
	};
}

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	vi.useFakeTimers();
	store = new HanabiGameStore(
		generateHanabiGameData({
			stage: HanabiStage.Playing,
			currentPlayerId: 'giver',
			actions: [clue],
		}),
	);
	mount = document.createElement('div');
	document.body.append(mount);
	root = createRoot(mount);
	act(() =>
		root.render(
			<HanabiGameContextProvider
				value={{
					store,
					code: 'TEST',
					gameMessenger: null,
					create: () => Promise.resolve('TEST'),
					watch: () => Promise.resolve(),
				}}
			>
				<HanabiHighlightController>
					<HighlightProbe />
				</HanabiHighlightController>
			</HanabiGameContextProvider>,
		),
	);
});

afterEach(() => {
	act(() => root.unmount());
	mount.remove();
	vi.useRealTimers();
});

it('keeps a clue through the next turn, elapsed time, chat, and moved cards', () => {
	const expected = { id: 'clue', label: '3', tiles: ['tile-a'] };
	expect(selectedHighlight()).toEqual(expected);
	act(() => store.receive({ ...store.game.getSnapshot()!, currentPlayerId: 'recipient' }));
	act(() => {
		vi.advanceTimersByTime(60_000);
	});
	expect(selectedHighlight()).toEqual(expected);
	act(() =>
		store.receive({
			...store.game.getSnapshot()!,
			actions: [
				clue,
				{ id: 'chat', type: HanabiGameActionType.Chat, playerId: 'recipient', message: 'Thinking' },
			],
		}),
	);
	expect(selectedHighlight()).toEqual(expected);
	// MoveTiles updates positions without adding a gameplay action.
	act(() =>
		store.receive({
			...store.game.getSnapshot()!,
			tilePositions: { [tile.id]: { x: 120, y: 70, z: 1 } },
		}),
	);
	expect(selectedHighlight()).toEqual(expected);
});

it.each<HanabiGameAction>([
	{
		id: 'play',
		type: HanabiGameActionType.Play,
		playerId: 'recipient',
		tile,
		valid: true,
		remainingLives: 3,
	},
	{ id: 'discard', type: HanabiGameActionType.Discard, playerId: 'recipient', tile },
	{
		id: 'color-clue',
		type: HanabiGameActionType.GiveColorClue,
		playerId: 'recipient',
		recipientId: 'giver',
		color: 'red',
		tiles: [tile],
	},
	{ ...clue, id: 'number-clue', playerId: 'recipient', recipientId: 'giver' },
])('replaces the clue when the next $type action arrives', (nextAction) => {
	act(() =>
		store.receive({
			...store.game.getSnapshot()!,
			actions: [clue, nextAction],
			currentPlayerId: 'giver',
		}),
	);
	expect(selectedHighlight().id).toBe(nextAction.id);
});
