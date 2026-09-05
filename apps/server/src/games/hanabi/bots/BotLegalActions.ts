import {
	canHanabiPlayerDiscard,
	doesHanabiTileMatchClue,
	getHanabiClueColors,
	HanabiStage,
	type DebugPlayerAction,
	type HanabiGameData,
	type HanabiTileNumber,
} from '@hanabi/shared';

export interface BotLegalAction {
	id: string;
	action: DebugPlayerAction;
}

/** Enumerates choices using only hand membership and other players' visible faces. */
export function getBotLegalActions(gameData: HanabiGameData, botId: string): BotLegalAction[] {
	if (
		gameData.stage !== HanabiStage.Playing ||
		gameData.currentPlayerId !== botId ||
		!Object.hasOwn(gameData.players, botId)
	) {
		return [];
	}

	const actions: DebugPlayerAction[] = [];
	for (const tileId of gameData.playerTiles[botId] ?? []) {
		// Failed plays and critical discards are still legal choices. Their outcome is hidden.
		actions.push({ type: 'play', tileId });
		if (canHanabiPlayerDiscard(gameData.clues)) {
			actions.push({ type: 'discard', tileId });
		}
	}

	if (gameData.clues > 0) {
		for (const recipientId of gameData.turnOrder) {
			if (recipientId === botId) continue;
			const visibleTiles = (gameData.playerTiles[recipientId] ?? []).map(
				(tileId) => gameData.tiles[tileId],
			);
			for (const color of getHanabiClueColors(gameData.ruleSet)) {
				if (
					visibleTiles.some((tile) => doesHanabiTileMatchClue(tile, gameData.ruleSet, { color }))
				) {
					actions.push({ type: 'clue', to: recipientId, color });
				}
			}
			for (const number of [1, 2, 3, 4, 5] as const satisfies readonly HanabiTileNumber[]) {
				if (
					visibleTiles.some((tile) => doesHanabiTileMatchClue(tile, gameData.ruleSet, { number }))
				) {
					actions.push({ type: 'clue', to: recipientId, number });
				}
			}
		}
	}

	return actions.map((action, index) => ({ id: `action-${index}`, action }));
}
