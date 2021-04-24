import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { hanabiDragTypes, HanabiTileDragItem } from 'app/src/games/hanabi/client/HanabiDragTypes';
import { HANABI_BOARD_SIZE, HANABI_TILE_SIZE } from 'app/src/games/hanabi/HanabiGameData';
import { DragElementWrapper, useDrop } from 'react-dnd';

export default function useTileDrop(): DragElementWrapper<any> {
	const game = useHanabiGame();
	const userId = useUserId();

	// The entire screen should be used as a drop target. This is to work around
	// a limitation of HTML5 drag and drop API where the "return animation" is
	// played when dropping things outside drop targets.
	const [, dropRef] = useDrop<HanabiTileDragItem, void, void>({
		accept: [hanabiDragTypes.TILE],
		// hover: (item, monitor) => {
		// 	const delta = monitor.getDifferenceFromInitialOffset()!;
		// 	const origintalPosition = game.gameData.players[userId].tileLocations.find(
		// 		(l) => l.tile.id === item.id,
		// 	)!.position;

		// 	const left = Math.round(origintalPosition.x + delta.x);
		// 	const top = Math.round(origintalPosition.y + delta.y);

		// 	const leftClamped = Math.min(
		// 		Math.max(left, 0),
		// 		HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width,
		// 	);
		// 	const topClamped = Math.min(
		// 		Math.max(top, 0),
		// 		HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height,
		// 	);

		// 	const isTopHalf = topClamped < HANABI_BOARD_SIZE.height / 2;

		// 	// TODO:

		// 	// If in the top half, determine position and move tiles locally.
		// 	// If in bottom half, move all tiles to the left

		// 	console.log(isTopHalf);
		// },
		drop: (item, monitor) => {
			const delta = monitor.getDifferenceFromInitialOffset()!;
			const origintalPosition = game.gameData.players[userId].tileLocations.find(
				(l) => l.tile.id === item.id,
			)!.position;

			const left = Math.round(origintalPosition.x + delta.x);
			const top = Math.round(origintalPosition.y + delta.y);

			const leftClamped = Math.min(
				Math.max(left, 0),
				HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width,
			);
			const topClamped = Math.min(
				Math.max(top, 0),
				HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height,
			);

			// hover is handling the movement, so drop will just commit those moves to the server

			game.moveTileLocally(userId, item.id, { x: leftClamped, y: topClamped });
			game.commitTileMoves(userId);
		},
	});

	return dropRef;
}
