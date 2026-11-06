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
import type { DragLayerMonitor } from 'react-dnd';
import type { HanabiTileDragItem } from './HanabiDragTypes';
import { HanabiGameContextProvider } from './HanabiGameContext';
import { HanabiGameStore } from './HanabiGameStore';
import HanabiHighlightController from './HanabiHighlightController';
import { useHanabiHighlightContext } from './HanabiHighlightContext';
import { HanabiMoveTileContextProvider } from './HanabiMoveTileContext';
import HanabiPlayerTiles from './HanabiPlayerTiles';

const drag = vi.hoisted(() => ({ item: null as HanabiTileDragItem | null }));
vi.mock('~/components/SocketContext', () => ({ useUserId: () => 'recipient' }));
vi.mock('./useTileDrag', () => ({
	default: () => ({ isDragging: Boolean(drag.item), dragRef: () => {} }),
}));
vi.mock('./useJustTookAction', () => ({ default: () => false }));
vi.mock('react-dnd', () => ({
	useDragLayer: (collect: (monitor: Partial<DragLayerMonitor>) => unknown) =>
		collect({
			getItem: <T,>() => drag.item as T,
			getItemType: () => drag.item?.type ?? null,
			isDragging: () => Boolean(drag.item),
			getDifferenceFromInitialOffset: () => null,
			getSourceClientOffset: () => (drag.item ? { x: 20, y: 30 } : null),
		}),
}));

const tile = { id: 'touched', color: 'rainbow', number: 3 } as const;
const untouched = { id: 'untouched', color: 'blue', number: 1 } as const;
const oldClue: HanabiGameAction = {
	id: 'old-color',
	type: HanabiGameActionType.GiveColorClue,
	playerId: 'giver',
	recipientId: 'recipient',
	color: 'red',
	tiles: [tile],
};
const latestClue: HanabiGameAction = {
	id: 'latest-number',
	type: HanabiGameActionType.GiveNumberClue,
	playerId: 'giver',
	recipientId: 'recipient',
	number: 3,
	tiles: [tile],
};
const positions = { touched: { x: 10, y: 10, z: 1 }, untouched: { x: 60, y: 10, z: 2 } };
let root: Root;
let mount: HTMLDivElement;
let store: HanabiGameStore;

function HistorySelection() {
	const { highlightAction } = useHanabiHighlightContext();
	return <button onClick={() => highlightAction(oldClue.id)}>Select old clue</button>;
}

beforeEach(() => {
	(
		globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
	).IS_REACT_ACT_ENVIRONMENT = true;
	drag.item = null;
	store = new HanabiGameStore(
		generateHanabiGameData({
			stage: HanabiStage.Playing,
			currentPlayerId: 'recipient',
			showNotes: false,
			players: { recipient: { id: 'recipient', name: 'Recipient', connected: true } },
			playerTiles: { recipient: [tile.id, untouched.id] },
			tiles: { [tile.id]: tile, [untouched.id]: untouched },
			tilePositions: positions,
			actions: [oldClue, latestClue],
		}),
	);
	mount = document.createElement('div');
	document.body.append(mount);
	root = createRoot(mount);
});

afterEach(() => {
	act(() => root.unmount());
	mount.remove();
});

function render(variant: 'desktop' | 'legacy') {
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
				<HanabiMoveTileContextProvider
					value={{ tilePositions: positions, moveTiles: () => Promise.resolve() }}
				>
					<HanabiHighlightController>
						<HistorySelection />
						<HanabiPlayerTiles id="recipient" variant={variant} />
					</HanabiHighlightController>
				</HanabiMoveTileContextProvider>
			</HanabiGameContextProvider>,
		),
	);
}

it.each(['desktop', 'legacy'] as const)(
	'keeps %s card and dragged clues live and independent of history selection',
	(variant) => {
		render(variant);
		const card = () => mount.querySelector('[data-hanabi-tile-id="touched"]')!;
		expect(card().querySelector('[data-hanabi-clue="number-3"]')).not.toBeNull();
		expect(card().getAttribute('aria-label')).toContain('Latest clue: 3.');
		expect(mount.querySelector('[data-hanabi-tile-id="untouched"] [data-hanabi-clue]')).toBeNull();
		expect(mount.querySelector('.hanabi-tile-note-marker')).toBeNull();

		act(() => mount.querySelector('button')!.click());
		expect(card().querySelector('[data-hanabi-clue="number-3"]')).not.toBeNull();
		expect(mount.querySelector('[data-hanabi-clue="color-red"]')).toBeNull();

		drag.item = {
			type: 'tile',
			id: tile.id,
			originalPosition: positions.touched,
			highlight: true,
			highlightTone: 'red',
			notesIndicator: false,
			responsiveSurface: variant === 'desktop',
			renderedTileSize: { width: 50, height: 64 },
			sourcePosition: { x: 10, y: 10 },
			surfaceSize: { width: 300, height: 200 },
		};
		render(variant);
		const portalCard = () =>
			document.querySelector('body > .pointer-events-none .hanabi-tile-shell');
		expect(portalCard()?.getAttribute('data-hanabi-clue')).toBe('number-3');

		act(() =>
			store.receive({
				...store.game.getSnapshot()!,
				tilePositions: { ...positions, touched: { x: 120, y: 70, z: 3 } },
				actions: [
					...store.game.getSnapshot()!.actions,
					{
						id: 'chat',
						type: HanabiGameActionType.Chat,
						playerId: 'recipient',
						message: 'Thinking',
					},
				],
			}),
		);
		expect(portalCard()?.getAttribute('data-hanabi-clue')).toBe('number-3');

		act(() =>
			store.receive({
				...store.game.getSnapshot()!,
				actions: [
					...store.game.getSnapshot()!.actions,
					{
						id: 'discard',
						type: HanabiGameActionType.Discard,
						playerId: 'recipient',
						tile: untouched,
					},
				],
			}),
		);
		expect(portalCard()).not.toBeNull();
		expect(portalCard()?.hasAttribute('data-hanabi-clue')).toBe(false);
		expect(card().querySelector('[data-hanabi-clue]')).toBeNull();
		expect(card().getAttribute('aria-label')).not.toContain('Latest clue:');
	},
);
