import { HanabiHighlightContextProvider } from '~/games/hanabi/client/HanabiHighlightContext';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { getHanabiActionHighlight } from '~/games/hanabi/client/useActionHighlighter';
import { useMemo, useState } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function HanabiHighlightController({ children }: Props): JSX.Element {
	const gameData = useGameData();
	const [highlightedAction, setHighlightedAction] = useState<string | null>(null);
	const actionHighlight = useMemo(() => {
		const action = gameData.actions.find(({ id }) => id === highlightedAction);
		return action ? getHanabiActionHighlight(action) : null;
	}, [gameData.actions, highlightedAction]);
	const highlightedTiles = useMemo(
		() => new Set(actionHighlight?.tileIds ?? []),
		[actionHighlight?.tileIds],
	);

	const contextValue = useMemo(
		() => ({
			highlightAction: setHighlightedAction,
			highlightedAction,
			highlightedLabel: actionHighlight?.label ?? null,
			highlightedRecipientId: actionHighlight?.recipientId ?? null,
			highlightedTiles,
			highlightedTone: actionHighlight?.tone ?? null,
		}),
		[actionHighlight, highlightedAction, highlightedTiles],
	);

	return (
		<HanabiHighlightContextProvider value={contextValue}>{children}</HanabiHighlightContextProvider>
	);
}
