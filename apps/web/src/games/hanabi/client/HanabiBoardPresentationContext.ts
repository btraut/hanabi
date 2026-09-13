import { createContext, useContext } from 'react';
import { HanabiBoardData, SnapshotChannel } from './HanabiGameStore';

export interface HanabiBoardPresentationSnapshot {
	gameData: HanabiBoardData;
	transitioningTileId: string | null;
	drawingTileId: string | null;
}
export const HanabiBoardPresentationContext =
	createContext<SnapshotChannel<HanabiBoardPresentationSnapshot> | null>(null);
export const useBoardPresentationChannel = () => useContext(HanabiBoardPresentationContext);
