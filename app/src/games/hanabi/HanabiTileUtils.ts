import {
	HANABI_TILE_SIZE,
	HanabiTileLocation,
	Position,
	Rect,
} from 'app/src/games/hanabi/HanabiGameData';

export function detectRectCollision(rect1: Rect, rect2: Rect): boolean {
	return (
		rect1.x < rect2.x + rect2.width &&
		rect1.x + rect1.width > rect2.x &&
		rect1.y < rect2.y + rect2.height &&
		rect1.y + rect1.height > rect2.y
	);
}

// This is an extremely naive function that finds a blank space on the x axis to
// hold the next tile. It fixes on the y axis and it always assumes it'll find a
// space.
export function findBlankSpaceForTile(
	tileLocations: HanabiTileLocation[],
	startPosition: Position = { x: 10, y: 10 },
): Position {
	const tileLocationsSortedByX = tileLocations.sort((a, b) =>
		a.position.x < b.position.x ? -1 : 1,
	);

	let currentX = startPosition.x;

	for (const tileLocation of tileLocationsSortedByX) {
		if (
			detectRectCollision(
				{ x: currentX, y: startPosition.y, ...HANABI_TILE_SIZE },
				{ ...tileLocation.position, ...HANABI_TILE_SIZE },
			)
		) {
			currentX = tileLocation.position.x + HANABI_TILE_SIZE.width + 10;
		}
	}

	return { x: currentX, y: startPosition.y };
}
