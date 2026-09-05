import HanabiGameMessenger from './HanabiGameMessenger';
import { HanabiGameData } from '@hanabi/shared';
import { createContext, useContext, useSyncExternalStore } from 'react';
import { HanabiBoardData, HanabiGameStore, SnapshotChannel } from './HanabiGameStore';
import { useBoardPresentationChannel } from './HanabiBoardPresentationContext';

export interface HanabiGameContext {
	create(): Promise<string>;
	watch(code: string): Promise<void>;
	gameMessenger: HanabiGameMessenger | null;
	store: HanabiGameStore;
	code: string | null;
}
const context = createContext<HanabiGameContext | null>(null);
export function useHanabiGameContext(): HanabiGameContext {
	const value = useContext(context);
	if (!value)
		throw new Error('useHanabiGameContext must be used within a HanabiGameContextProvider.');
	return value;
}
export function useGameMessenger(): HanabiGameMessenger {
	const { gameMessenger } = useHanabiGameContext();
	if (!gameMessenger) throw new Error('No game messenger loaded.');
	return gameMessenger;
}
function requireGame<T>(snapshot: T | null): T {
	if (!snapshot) throw new Error('No game data loaded.');
	return snapshot;
}
function useChannel<T>(channel: SnapshotChannel<T>): T {
	return useSyncExternalStore(channel.subscribe, channel.getSnapshot, channel.getSnapshot);
}
// Selectors must return a primitive or a branch of the immutable snapshot.
export function useGameSelector<T>(select: (game: HanabiGameData | null) => T): T {
	const { store } = useHanabiGameContext();
	const getSnapshot = () => select(store.game.getSnapshot());
	return useSyncExternalStore(store.game.subscribe, getSnapshot, getSnapshot);
}
export function useGameData(): HanabiGameData {
	return requireGame(useChannel(useHanabiGameContext().store.game));
}
export function useBoardData(): HanabiBoardData {
	const { store } = useHanabiGameContext();
	const presentation = useBoardPresentationChannel();
	const subscribe = presentation?.subscribe ?? store.board.subscribe;
	const getSnapshot = () =>
		presentation ? presentation.getSnapshot().gameData : store.board.getSnapshot();
	return requireGame(useSyncExternalStore(subscribe, getSnapshot, getSnapshot));
}
export function useActivityData() {
	return requireGame(useChannel(useHanabiGameContext().store.activity));
}
export function useBotStatusData() {
	return requireGame(useChannel(useHanabiGameContext().store.bots));
}
const noSubscription = () => () => {};
export function useTransitioningTileId(): string | null {
	const presentation = useBoardPresentationChannel();
	const getSnapshot = () => presentation?.getSnapshot().transitioningTileId ?? null;
	return useSyncExternalStore(presentation?.subscribe ?? noSubscription, getSnapshot, getSnapshot);
}
export const HanabiGameContextProvider = context.Provider;
