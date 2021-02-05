import { useUserId } from 'app/src/components/SocketContext';
import { useHanabiHighlightContext } from 'app/src/games/hanabi/client/HanabiHighlightContext';
import useLatestActions from 'app/src/games/hanabi/client/useLatestActions';
import {
	HanabiGameActionDiscard,
	HanabiGameActionGiveClue,
	HanabiGameActionPlay,
	HanabiGameActionType,
} from 'app/src/games/hanabi/HanabiGameData';
import { useEffect } from 'react';

export default function useActionHighlighter(): void {
	const userId = useUserId();

	const { highlightAction, highlightTiles } = useHanabiHighlightContext();

	const latestActions = useLatestActions();
	const latestTileAction:
		| HanabiGameActionPlay
		| HanabiGameActionDiscard
		| HanabiGameActionGiveClue = latestActions
		.reverse()
		.find((a) =>
			[
				HanabiGameActionType.Play,
				HanabiGameActionType.Discard,
				HanabiGameActionType.GiveColorClue,
				HanabiGameActionType.GiveNumberClue,
			].includes(a.type),
		) as any;

	useEffect(() => {
		if (!latestTileAction) {
			return;
		}

		if (
			latestTileAction.type === HanabiGameActionType.Play ||
			latestTileAction.type === HanabiGameActionType.Discard
		) {
			if (latestTileAction.playerId === userId) {
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
			if (latestTileAction.playerId === userId) {
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
