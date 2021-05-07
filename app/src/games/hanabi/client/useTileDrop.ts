import { useUserId } from 'app/src/components/SocketContext';
import {
	getNewPositionsForTiles,
	getPositionInContainer,
	getSlotXForDraggingTile,
	isTileInTopHalf,
} from 'app/src/games/hanabi/client/HanabiDragDropUtils';
import { HANABI_DRAG_TYPES, HanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { useGameData } from 'app/src/games/hanabi/client/HanabiGameContext';
import { useHanabiMoveTileContext } from 'app/src/games/hanabi/client/HanabiMoveTileContext';
import { Position } from 'app/src/games/hanabi/HanabiGameData';
import { useRef } from 'react';
import { DragElementWrapper, useDrop } from 'react-dnd';

export default function useTileDrop(): DragElementWrapper<any> {
	const gameData = useGameData();
	const userId = useUserId();
	const { moveTiles } = useHanabiMoveTileContext();

	const previousIsTopHalfRef = useRef<boolean | null>(null);
	const previousTileSlotX = useRef<number | null>(null);

	// The entire screen should be used as a drop target. This is to work around
	// a limitation of HTML5 drag and drop API where the "return animation" is
	// played when dropping things outside drop targets.
	const [, dropRef] = useDrop<HanabiDragTypes, void, void>({
		accept: [HANABI_DRAG_TYPES.TILE],
		hover: (item, monitor) => {
			const originalPosition = gameData.tilePositions[item.id];

			const delta = monitor.getDifferenceFromInitialOffset()!;
			const newPosition = getPositionInContainer(originalPosition, delta);

			const isTopHalf = isTileInTopHalf(newPosition);
			const tileSlotX = getSlotXForDraggingTile(newPosition.x);

			if (
				isTopHalf !== previousIsTopHalfRef.current ||
				(isTopHalf && tileSlotX !== previousTileSlotX.current)
			) {
				const tilePositions: { [tileId: string]: Position } = {};
				for (const tileId of gameData.playerTiles[userId]) {
					if (tileId !== item.id) {
						tilePositions[tileId] = gameData.tilePositions[tileId];
					}
				}

				// TODO: Make this way faster.
				const newPositions = getNewPositionsForTiles(
					{ [item.id]: newPosition },
					tilePositions,
					false,
				);

				moveTiles(newPositions, false);
			}

			previousIsTopHalfRef.current = isTopHalf;
			previousTileSlotX.current = tileSlotX;
		},
		drop: (item, monitor) => {
			const originalPosition = gameData.tilePositions[item.id];

			const delta = monitor.getDifferenceFromInitialOffset()!;
			const newPosition = getPositionInContainer(originalPosition, delta);

			const tilePositions: { [tileId: string]: Position } = {};
			for (const tileId of gameData.playerTiles[userId]) {
				if (tileId !== item.id) {
					tilePositions[tileId] = gameData.tilePositions[tileId];
				}
			}

			const newPositions = getNewPositionsForTiles({ [item.id]: newPosition }, tilePositions, true);

			moveTiles(newPositions, true);

			previousIsTopHalfRef.current = null;
			previousTileSlotX.current = null;
		},
	});

	return dropRef;
}
