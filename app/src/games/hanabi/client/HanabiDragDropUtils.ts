import {
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_PADDING,
	HANABI_TILE_SIZE,
	Position,
} from 'app/src/games/hanabi/HanabiGameData';
import { XYCoord } from 'react-dnd';

export function getPositionInContainer(originalPosition: Position, delta: XYCoord): Position {
	const left = Math.round(originalPosition.x + delta.x);
	const top = Math.round(originalPosition.y + delta.y);

	const leftClamped = Math.min(Math.max(left, 0), HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width);
	const topClamped = Math.min(Math.max(top, 0), HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height);

	return { x: leftClamped, y: topClamped, z: originalPosition.z };
}

export function getSlotXForDraggingTile(x: number, max: number = Number.MAX_SAFE_INTEGER): number {
	const slot = Math.floor(
		(x + HANABI_TILE_SIZE.width / 2) / (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width),
	);

	return Math.max(Math.min(slot, max), 0);
}

export function isTileInTopHalf(position: Position): boolean {
	return position.y < HANABI_BOARD_SIZE.height / 2 - HANABI_DEFAULT_TILE_PADDING;
}

export function getNewPositionsForTiles(
	draggingTile: {
		[tileId: string]: Position;
	},
	otherTilePositions: {
		[tileId: string]: Position;
	},
	includeDraggingTile = true,
): { [tileId: string]: Position } {
	const topTiles: { id: string; position: Position }[] = [];
	const bottomTiles: { id: string; position: Position }[] = [];

	let maxZIndex = 0;

	// Separate tiles into top and bottom.
	for (const tileId of Object.keys(otherTilePositions)) {
		const position = { ...otherTilePositions[tileId] };

		if (isTileInTopHalf(position)) {
			topTiles.push({ id: tileId, position });
		} else {
			bottomTiles.push({ id: tileId, position });
		}

		if (position.z > maxZIndex) {
			maxZIndex = position.z;
		}
	}

	const draggingTileKey = Object.keys(draggingTile)[0];
	const draggingTilePosition = draggingTile[draggingTileKey];
	const draggingTileIsTop = isTileInTopHalf(draggingTilePosition);
	const draggingTileSlotX = getSlotXForDraggingTile(draggingTilePosition.x, topTiles.length);

	// Sort the top tiles by x position.
	topTiles.sort((a, b) => (a.position.x < b.position.x ? -1 : 1));

	// Update top tiles x position based on default locations/padding.
	for (let i = 0; i < topTiles.length; i++) {
		const tile = topTiles[i];

		const slot = draggingTileIsTop && draggingTileSlotX <= i ? i + 1 : i;

		tile.position = {
			x:
				HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * slot,
			y: HANABI_DEFAULT_TILE_PADDING,
			z: tile.position.z,
		};
	}

	// Save all positions back to positions map.
	const newPositions: { [tileId: string]: Position } = {};

	for (const tile of [...topTiles, ...bottomTiles]) {
		newPositions[tile.id] = tile.position;
	}

	// Conditionally add the dragging tile position.
	if (includeDraggingTile) {
		if (draggingTileIsTop) {
			newPositions[draggingTileKey] = {
				x:
					HANABI_DEFAULT_TILE_PADDING +
					(HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * draggingTileSlotX,
				y: HANABI_DEFAULT_TILE_PADDING,
				z: maxZIndex + 1,
			};
		} else {
			newPositions[draggingTileKey] = { ...draggingTilePosition, z: maxZIndex };
		}
	}

	return newPositions;
}
