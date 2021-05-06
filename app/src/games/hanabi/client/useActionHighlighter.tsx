import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import { useLatestTileAction } from 'app/src/games/hanabi/client/useLatestActions';
import { HanabiGameActionType } from 'app/src/games/hanabi/HanabiGameData';
import { useEffect } from 'react';

const HIGHLIGHT_FOR_ACTING_USER = true;

export default function useActionHighlighter(): void {
	const userId = useUserId();

	const { highlightAction, highlightTiles } = useHanabiHighlightContext();

	const latestTileAction = useLatestTileAction();

	useEffect(() => {
		if (!latestTileAction) {
			return;
		}

		if (
			latestTileAction.type === HanabiGameActionType.Play ||
			latestTileAction.type === HanabiGameActionType.Discard
		) {
			if (latestTileAction.playerId === userId && !HIGHLIGHT_FOR_ACTING_USER) {
				// Clear highlights.
				highlightAction(null);
				highlightTiles(new Set());
			} else {
				// Highlight action.
				highlightAction(latestTileAction.id);

				// Highlight tile.
				highlightTiles(new Set([latestTileAction.tile.id]));
			}
		} else if (
			latestTileAction.type === HanabiGameActionType.GiveColorClue ||
			latestTileAction.type === HanabiGameActionType.GiveNumberClue
		) {
			if (latestTileAction.playerId === userId && !HIGHLIGHT_FOR_ACTING_USER) {
				// Clear highlights.
				highlightAction(null);
				highlightTiles(new Set());
			} else {
				// Highlight action.
				highlightAction(latestTileAction.id);

				// Highlight tiles.
				highlightTiles(new Set(latestTileAction.tiles.map((a) => a.id)));
			}
		}
	}, [highlightAction, highlightTiles, latestTileAction, userId]);
}
