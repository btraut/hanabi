import { useUserId } from '~/components/SocketContext';
import {
	HanabiTileHighlightTone,
	useHanabiHighlightContext,
} from '~/games/hanabi/client/HanabiHighlightContext';
import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiGameAction, HanabiGameActionType } from '@hanabi/shared';
import { useEffect } from 'react';

const HIGHLIGHT_FOR_ACTING_USER = true;

export interface HanabiActionHighlight {
	label: string | null;
	recipientId: string | null;
	tileIds: string[];
	tone: HanabiTileHighlightTone;
}

export function getHanabiActionHighlight(action: HanabiGameAction): HanabiActionHighlight | null {
	if (action.type === HanabiGameActionType.GiveColorClue) {
		return {
			label: action.color ? action.color.charAt(0).toUpperCase() + action.color.slice(1) : null,
			recipientId: action.recipientId,
			tileIds: action.tiles.map((tile) => tile.id),
			tone: action.color ?? 'action',
		};
	}

	if (action.type === HanabiGameActionType.GiveNumberClue) {
		return {
			label: action.number?.toString() ?? null,
			recipientId: action.recipientId,
			tileIds: action.tiles.map((tile) => tile.id),
			tone: 'number',
		};
	}

	if (action.type === HanabiGameActionType.Play || action.type === HanabiGameActionType.Discard) {
		return {
			label: null,
			recipientId: null,
			tileIds: [action.tile.id],
			tone: 'action',
		};
	}

	return null;
}

export function getLatestHanabiTileAction(
	actions: readonly HanabiGameAction[],
): HanabiGameAction | null {
	for (let index = actions.length - 1; index >= 0; index -= 1) {
		const action = actions[index];
		if (action && getHanabiActionHighlight(action)) return action;
	}

	return null;
}

export default function useActionHighlighter(): void {
	const userId = useUserId();
	const gameData = useGameData();
	const { highlightAction } = useHanabiHighlightContext();
	const latestTileAction = getLatestHanabiTileAction(gameData.actions);
	const latestTileActionId = latestTileAction?.id ?? null;
	const latestTileActionPlayerId =
		latestTileAction && 'playerId' in latestTileAction ? latestTileAction.playerId : null;

	useEffect(() => {
		if (!latestTileActionId || !latestTileActionPlayerId) return;

		if (latestTileActionPlayerId === userId && !HIGHLIGHT_FOR_ACTING_USER) {
			highlightAction(null);
			return;
		}

		highlightAction(latestTileActionId);
	}, [highlightAction, latestTileActionId, latestTileActionPlayerId, userId]);
}
