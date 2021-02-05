import { HanabiHighlightContextProvider } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import { useMemo, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiHighlightController({ children }: Props): JSX.Element {
	const [highlightedTiles, setHighlightedTiles] = useState(new Set<string>());
	const [highlightedAction, setHighlightedAction] = useState<string | null>(null);

	const contextValue = useMemo(
		() => ({
			highlightTiles: setHighlightedTiles,
			highlightedTiles,
			highlightAction: setHighlightedAction,
			highlightedAction,
		}),
		[highlightedAction, highlightedTiles],
	);

	return (
		<HanabiHighlightContextProvider value={contextValue}>{children}</HanabiHighlightContextProvider>
	);
}
