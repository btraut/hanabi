import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import {
	getNewPositionsForTiles,
	getPositionInContainer,
	getSlotXForDraggingTile,
	getTilePositions,
	getTileZIndexes,
} from 'app/src/games/hanabi/client/HanabiDragDropUtils';
import { HANABI_DRAG_TYPES, HanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { HANABI_BOARD_SIZE } from 'app/src/games/hanabi/HanabiGameData';
import { useRef } from 'react';
import { DragElementWrapper, useDrop } from 'react-dnd';

export default function useTileDrop(): DragElementWrapper<any> {
	const game = useHanabiGame();
	const userId = useUserId();

	const previousIsTopHalfRef = useRef<boolean | null>(null);
	const previousTileSlotX = useRef<number | null>(null);

	// The entire screen should be used as a drop target. This is to work around
	// a limitation of HTML5 drag and drop API where the "return animation" is
	// played when dropping things outside drop targets.
	const [, dropRef] = useDrop<HanabiDragTypes, void, void>({
		accept: [HANABI_DRAG_TYPES.TILE],
		hover: (item, monitor) => {
			const originalPosition = game.gameData.players[userId].tileLocations.find(
				(l) => l.tile.id === item.id,
			)!.position;
			const delta = monitor.getDifferenceFromInitialOffset()!;
			const newPosition = getPositionInContainer(originalPosition, delta);

			const isTopHalf = newPosition.y < HANABI_BOARD_SIZE.height / 2;
			const tileSlotX = getSlotXForDraggingTile(newPosition.x);

			if (isTopHalf !== previousIsTopHalfRef.current || tileSlotX !== previousTileSlotX.current) {
				const tilePositions = getTilePositions(game.gameData.players[userId].tileLocations);
				delete tilePositions[item.id];

				const tileZIndexes = getTileZIndexes(game.gameData.players[userId].tileLocations);
				delete tileZIndexes[item.id];

				const newPositions = getNewPositionsForTiles(
					{ [item.id]: newPosition },
					tilePositions,
					false,
				);

				game.moveTilesLocally(userId, newPositions);
			}

			previousIsTopHalfRef.current = isTopHalf;
			previousTileSlotX.current = tileSlotX;
		},
		drop: (item, monitor) => {
			const originalPosition = game.gameData.players[userId].tileLocations.find(
				(l) => l.tile.id === item.id,
			)!.position;
			const delta = monitor.getDifferenceFromInitialOffset()!;
			const newPosition = getPositionInContainer(originalPosition, delta);

			const tilePositions = getTilePositions(game.gameData.players[userId].tileLocations);
			delete tilePositions[item.id];

			const newPositions = getNewPositionsForTiles({ [item.id]: newPosition }, tilePositions, true);

			game.moveTilesLocally(userId, newPositions, item.id);
			game.commitTileMoves(userId);

			previousIsTopHalfRef.current = null;
			previousTileSlotX.current = null;
		},
	});

	return dropRef;
}
