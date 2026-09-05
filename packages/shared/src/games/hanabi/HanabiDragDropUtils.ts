import {
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_PADDING,
	HANABI_TILE_SIZE,
	HANABI_WORKSPACE_ZONE_BOUNDARY,
	Position,
} from './HanabiGameData.js';

const HANABI_LEGACY_WORKSPACE_ZONE_BOUNDARY = 48 + HANABI_DEFAULT_TILE_PADDING;
const HANABI_HAND_MAX_X = HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width;
const HANABI_HAND_MAX_Y = HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height;
const HANABI_LOWER_AREA_HEIGHT = HANABI_HAND_MAX_Y - HANABI_WORKSPACE_ZONE_BOUNDARY;

/** Card IDs in queue order, with lower-area coordinates normalized to the space a full card can occupy. */
export interface HanabiHandLayout {
	orderedRow: string[];
	lowerArea: Array<{ tileId: string; x: number; y: number; stackOrder: number }>;
}

function getOrderedPosition(slot: number, z = 0): Position {
	return {
		x: HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * slot,
		y: HANABI_DEFAULT_TILE_PADDING,
		z,
	};
}

function getHandTiles(tileIds: readonly string[], positions: Readonly<Record<string, Position>>) {
	return tileIds.map((tileId, index) => ({
		tileId,
		position: positions[tileId] ?? getOrderedPosition(index),
	}));
}

function clampUnit(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Project only the requested hand; raw z values become relative bottom-to-top stack order. */
export function getHanabiHandLayout(
	tileIds: readonly string[],
	positions: Readonly<Record<string, Position>>,
): HanabiHandLayout {
	const tiles = getHandTiles(tileIds, positions);
	return {
		orderedRow: tiles
			.filter(({ position }) => isTileInTopHalf(position))
			.sort((a, b) => a.position.x - b.position.x)
			.map(({ tileId }) => tileId),
		lowerArea: tiles
			.filter(({ position }) => !isTileInTopHalf(position))
			.sort((a, b) => a.position.z - b.position.z)
			.map(({ tileId, position }, stackOrder) => ({
				tileId,
				x: clampUnit(position.x / HANABI_HAND_MAX_X),
				y: clampUnit((position.y - HANABI_WORKSPACE_ZONE_BOUNDARY) / HANABI_LOWER_AREA_HEIGHT),
				stackOrder,
			})),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnitCoordinate(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

/** Validate a complete declarative own-hand target before creating any coordinate changes. */
export function getHanabiPositionsForLayout(
	tileIds: readonly string[],
	layout: unknown,
): Record<string, Position> | null {
	if (!isRecord(layout) || !Array.isArray(layout.orderedRow) || !Array.isArray(layout.lowerArea)) {
		return null;
	}
	const remaining = new Set(tileIds);
	if (remaining.size !== tileIds.length) return null;
	const entries: Array<[string, Position]> = [];
	for (const [slot, tileId] of layout.orderedRow.entries()) {
		if (typeof tileId !== 'string' || !remaining.delete(tileId)) return null;
		const position = getOrderedPosition(slot);
		if (position.x > HANABI_HAND_MAX_X) return null;
		entries.push([tileId, position]);
	}
	const stackOrders = new Set<number>();
	for (const placement of layout.lowerArea) {
		if (
			!isRecord(placement) ||
			typeof placement.tileId !== 'string' ||
			!remaining.delete(placement.tileId) ||
			!isUnitCoordinate(placement.x) ||
			!isUnitCoordinate(placement.y) ||
			typeof placement.stackOrder !== 'number' ||
			!Number.isSafeInteger(placement.stackOrder) ||
			placement.stackOrder < 0 ||
			stackOrders.has(placement.stackOrder)
		) {
			return null;
		}
		stackOrders.add(placement.stackOrder);
		entries.push([
			placement.tileId,
			{
				x: placement.x * HANABI_HAND_MAX_X,
				y: HANABI_WORKSPACE_ZONE_BOUNDARY + placement.y * HANABI_LOWER_AREA_HEIGHT,
				z: placement.stackOrder,
			},
		]);
	}
	return remaining.size === 0 ? Object.fromEntries(entries) : null;
}

/** Pack the upper queue without changing its order or any lower placement/stacking. */
export function packHanabiHandPositions(
	tileIds: readonly string[],
	positions: Readonly<Record<string, Position>>,
): Record<string, Position> {
	const tiles = getHandTiles(tileIds, positions);
	const topTiles = tiles
		.filter(({ position }) => isTileInTopHalf(position))
		.sort((a, b) => a.position.x - b.position.x);
	const packed = new Map(
		topTiles.map(({ tileId, position }, slot) => [tileId, getOrderedPosition(slot, position.z)]),
	);
	return Object.fromEntries(
		tiles.map(({ tileId, position }) => [tileId, packed.get(tileId) ?? { ...position }]),
	);
}

export function getSlotXForDraggingTile(x: number, max: number = Number.MAX_SAFE_INTEGER): number {
	const slot = Math.floor(
		(x + HANABI_TILE_SIZE.width / 2) / (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width),
	);

	return Math.max(Math.min(slot, max), 0);
}

export function isTileInTopHalf(position: Position): boolean {
	return position.y < HANABI_WORKSPACE_ZONE_BOUNDARY;
}

export function normalizeLegacyHanabiTilePositions(
	positions: Record<string, Position>,
): Record<string, Position> {
	return Object.fromEntries(
		Object.entries(positions).map(([tileId, position]) => [
			tileId,
			position.y >= HANABI_LEGACY_WORKSPACE_ZONE_BOUNDARY &&
			position.y < HANABI_WORKSPACE_ZONE_BOUNDARY
				? { ...position, y: HANABI_WORKSPACE_ZONE_BOUNDARY }
				: position,
		]),
	);
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
				z: maxZIndex,
			};
		} else {
			newPositions[draggingTileKey] = { ...draggingTilePosition, z: maxZIndex + 1 };
		}
	}

	return newPositions;
}

// Client-only function that uses react-dnd XYCoord type
// This is kept separate to avoid importing react-dnd in the server
export function getPositionInContainer(
	originalPosition: Position,
	delta: { x: number; y: number },
): Position {
	const left = Math.round(originalPosition.x + delta.x);
	const top = Math.round(originalPosition.y + delta.y);

	const leftClamped = Math.min(Math.max(left, 0), HANABI_BOARD_SIZE.width - HANABI_TILE_SIZE.width);
	const topClamped = Math.min(Math.max(top, 0), HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height);

	return { x: leftClamped, y: topClamped, z: originalPosition.z };
}
