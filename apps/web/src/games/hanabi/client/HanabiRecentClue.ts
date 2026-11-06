import {
	HanabiClueColor,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiTileNumber,
} from '@hanabi/shared';
import { getLatestHanabiTileAction } from './useActionHighlighter';

export type HanabiTileClue =
	{ type: 'color'; value: HanabiClueColor } | { type: 'number'; value: HanabiTileNumber };

// Only the latest turn can paint a card back; Activity selection is independent.
export function getHanabiRecentTileClue(
	actions: readonly HanabiGameAction[],
	recipientId: string,
	tileId: string,
): HanabiTileClue | undefined {
	const action = getLatestHanabiTileAction(actions);
	if (
		!action ||
		(action.type !== HanabiGameActionType.GiveColorClue &&
			action.type !== HanabiGameActionType.GiveNumberClue) ||
		action.recipientId !== recipientId ||
		!action.tiles.some((tile) => tile.id === tileId)
	)
		return undefined;

	if (action.type === HanabiGameActionType.GiveColorClue && action.color) {
		return { type: 'color', value: action.color };
	}
	if (action.type === HanabiGameActionType.GiveNumberClue && action.number) {
		return { type: 'number', value: action.number };
	}
	return undefined;
}
