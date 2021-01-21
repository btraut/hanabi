import { HanabiHighlightTileContextProvider } from 'app/src/games/hanabi/client/HanabiHighlightTileContext';
import { useMemo, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiHighlightTileController({ children }: Props): JSX.Element {
	const [highlightedTiles, setHighlightedTiles] = useState(new Set<string>());

	const contextValue = useMemo(
		() => ({
			highlightedTiles,
			highlightTiles: setHighlightedTiles,
		}),
		[highlightedTiles],
	);

	return (
		<HanabiHighlightTileContextProvider value={contextValue}>
			{children}
		</HanabiHighlightTileContextProvider>
	);
}
