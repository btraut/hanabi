import {
	HANABI_BOARD_SIZE,
	HANABI_DEFAULT_TILE_PADDING,
	HANABI_TILE_SIZE,
	HANABI_WORKSPACE_ZONE_BOUNDARY,
	Position,
	getPositionInContainer,
	getSlotXForDraggingTile,
	isTileInTopHalf,
} from '@hanabi/shared';
import { CSSProperties } from 'react';

export const HANABI_DESKTOP_SURFACE_HEIGHT = 184;
export const HANABI_DESKTOP_TILE_INSET = 8;
export const HANABI_DESKTOP_TILE_GAP = 6;
export const HANABI_DESKTOP_TILE_SIZE = { height: 64, width: 50 } as const;
export const HANABI_DESKTOP_ZONE_HEIGHT =
	HANABI_DESKTOP_TILE_SIZE.height + HANABI_DESKTOP_TILE_INSET * 2;

export function getHanabiDesktopTileVisualDimensions(_hidden: boolean): {
	height: number;
	width: number;
} {
	return HANABI_DESKTOP_TILE_SIZE;
}

export function getHanabiDesktopFreeformProgress(logicalY: number): number {
	const logicalMax = HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height;
	return (
		(Math.min(Math.max(logicalY, HANABI_WORKSPACE_ZONE_BOUNDARY), logicalMax) -
			HANABI_WORKSPACE_ZONE_BOUNDARY) /
		Math.max(logicalMax - HANABI_WORKSPACE_ZONE_BOUNDARY, 1)
	);
}

export function getHanabiDesktopLogicalPositionFromRendered(
	renderedPosition: Position,
	surfaceWidth: number,
	tileSize: { height: number; width: number } = HANABI_DESKTOP_TILE_SIZE,
): Position {
	if (renderedPosition.y < HANABI_DESKTOP_ZONE_HEIGHT) {
		const visualStep = tileSize.width + HANABI_DESKTOP_TILE_GAP;
		const slot = Math.max(
			0,
			Math.round((renderedPosition.x - HANABI_DESKTOP_TILE_INSET) / visualStep),
		);
		return {
			x:
				HANABI_DEFAULT_TILE_PADDING + (HANABI_DEFAULT_TILE_PADDING + HANABI_TILE_SIZE.width) * slot,
			y: HANABI_DEFAULT_TILE_PADDING,
			z: renderedPosition.z,
		};
	}

	const visualMax = HANABI_DESKTOP_SURFACE_HEIGHT - HANABI_DESKTOP_TILE_INSET - tileSize.height;
	const visualProgress =
		(Math.min(Math.max(renderedPosition.y, HANABI_DESKTOP_ZONE_HEIGHT), visualMax) -
			HANABI_DESKTOP_ZONE_HEIGHT) /
		Math.max(visualMax - HANABI_DESKTOP_ZONE_HEIGHT, 1);
	const logicalMax = HANABI_BOARD_SIZE.height - HANABI_TILE_SIZE.height;

	return getPositionInContainer(
		{
			x: renderedPosition.x * (HANABI_BOARD_SIZE.width / Math.max(surfaceWidth, 1)),
			y:
				HANABI_WORKSPACE_ZONE_BOUNDARY +
				visualProgress * (logicalMax - HANABI_WORKSPACE_ZONE_BOUNDARY),
			z: renderedPosition.z,
		},
		{ x: 0, y: 0 },
	);
}

export function getHanabiDesktopOrderedTileSlot(position: Position, tileCount: number): number {
	return getSlotXForDraggingTile(position.x, Math.max(tileCount - 1, 0));
}

export function getHanabiDesktopTileStyle({
	hidden,
	position,
	tileCount,
}: {
	hidden: boolean;
	position: Position;
	tileCount: number;
}): CSSProperties {
	const { width: visualWidth } = getHanabiDesktopTileVisualDimensions(hidden);

	if (isTileInTopHalf(position)) {
		const slot = getHanabiDesktopOrderedTileSlot(position, tileCount);
		return {
			left: `var(--hanabi-player-tile-slot-${slot})`,
			top: 'var(--hanabi-player-tile-inset)',
		};
	}
	const progress = getHanabiDesktopFreeformProgress(position.y);
	const freeformBottomAnchor = HANABI_DESKTOP_SURFACE_HEIGHT - HANABI_DESKTOP_TILE_INSET;
	const freeformAnchorY =
		HANABI_DESKTOP_ZONE_HEIGHT + progress * (freeformBottomAnchor - HANABI_DESKTOP_ZONE_HEIGHT);

	return {
		left: `clamp(0px, ${(position.x / HANABI_BOARD_SIZE.width) * 100}%, calc(100% - var(--hanabi-player-tile-width, ${visualWidth}px)))`,
		top: `${freeformAnchorY}px`,
		transform: `translateY(-${progress * 100}%)`,
	};
}
