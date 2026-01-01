import { Position } from './HanabiGameData.js';
export declare function getSlotXForDraggingTile(x: number, max?: number): number;
export declare function isTileInTopHalf(position: Position): boolean;
export declare function getNewPositionsForTiles(draggingTile: {
    [tileId: string]: Position;
}, otherTilePositions: {
    [tileId: string]: Position;
}, includeDraggingTile?: boolean): {
    [tileId: string]: Position;
};
export declare function getPositionInContainer(originalPosition: Position, delta: {
    x: number;
    y: number;
}): Position;
//# sourceMappingURL=HanabiDragDropUtils.d.ts.map