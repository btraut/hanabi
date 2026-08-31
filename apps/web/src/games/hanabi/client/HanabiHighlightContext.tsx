import { HanabiClueColor } from '@hanabi/shared';
import { createContext, Dispatch, SetStateAction, useContext } from 'react';

export type HanabiTileHighlightTone = HanabiClueColor | 'action' | 'number';

export interface HanabiHighlightContext {
	readonly highlightAction: Dispatch<SetStateAction<string | null>>;
	readonly highlightedAction: string | null;
	readonly highlightedLabel: string | null;
	readonly highlightedRecipientId: string | null;
	readonly highlightedTiles: ReadonlySet<string>;
	readonly highlightedTone: HanabiTileHighlightTone | null;
}

const context = createContext<HanabiHighlightContext | null>(null);

export function useHanabiHighlightContext(): HanabiHighlightContext {
	const contextValue = useContext(context);

	if (contextValue === null) {
		throw new Error(
			'useHanabiHighlightContext must be used within a HanabiHighlightContextProvider',
		);
	}

	return contextValue;
}

export const HanabiHighlightContextConsumer = context.Consumer;
export const HanabiHighlightContextProvider = context.Provider;
