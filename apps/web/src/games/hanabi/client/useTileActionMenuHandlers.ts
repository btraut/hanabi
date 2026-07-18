// useTileActionMenuHandlers is basically a bunch of code that was inline to
// HanabiBoard, but crowded up that component. It defines a bunch of data and
// handlers pertaining to clicking on tiles and following action tooltip
// actions.

import { useUserId } from '~/components/SocketContext';
import { useGameData, useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiTileActionsTooltipType } from '~/games/hanabi/client/HanabiTileActionsTooltip';
import { HanabiTile, HanabiTileColor } from '@hanabi/shared';
import { useCallback, useState } from 'react';

type ActionMenuDetails = {
	tileId: string;
	type: HanabiTileActionsTooltipType;
	coords: {
		top: number;
		left: number;
	};
};

export default function useTileActionMenuHandlers(): {
	showMenuForTile: ActionMenuDetails | null;
	handleTileClick: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	handleActionsTooltipAction: (
		action: 'discard' | 'play' | 'color' | 'number',
		tile: HanabiTile,
		details?: { color?: HanabiTileColor },
	) => void;
	handleActionsTooltipOnClose: () => void;
} {
	const gameMessenger = useGameMessenger();
	const gameData = useGameData();
	const userId = useUserId();

	const [showMenuForTile, setShowMenuForTile] = useState<ActionMenuDetails | null>(null);

	const handleTileClick = useCallback(
		(event: React.MouseEvent<HTMLElement>, tileId: string) => {
			const rect = event.currentTarget.getBoundingClientRect();
			const ownTile = !!gameData.playerTiles[userId].includes(tileId);

			// What menu should we display?
			let type = ownTile
				? HanabiTileActionsTooltipType.Own
				: HanabiTileActionsTooltipType.OtherPlayer;
			if (gameData.clues === 0 && !ownTile) {
				type = HanabiTileActionsTooltipType.NoClues;
			}

			setShowMenuForTile({
				tileId,
				type,
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + window.scrollY,
				},
			});
		},
		[gameData, userId],
	);

	const handleActionsTooltipAction = useCallback(
		(
			action: 'discard' | 'play' | 'color' | 'number',
			tile: HanabiTile,
			details?: { color?: HanabiTileColor },
		) => {
			let tileOwner: string | null = null;

			for (const playerId in gameData.players) {
				if (gameData.playerTiles[playerId].includes(tile.id)) {
					tileOwner = playerId;
					break;
				}
			}

			if (!tileOwner) {
				throw new Error('Invalid tile. No owner found.');
			}

			switch (action) {
				case 'discard':
					void gameMessenger.discardTile(tile).catch((error: unknown) => {
						console.error('Could not discard the tile:', error);
					});
					break;
				case 'play':
					void gameMessenger.playTile(tile).catch((error: unknown) => {
						console.error('Could not play the tile:', error);
					});
					break;
				case 'color':
					void gameMessenger
						.giveColorClue(tileOwner, details?.color ?? tile.color)
						.catch((error: unknown) => {
							console.error('Could not give the color clue:', error);
						});
					break;
				case 'number':
					void gameMessenger.giveNumberClue(tileOwner, tile.number).catch((error: unknown) => {
						console.error('Could not give the number clue:', error);
					});
					break;
			}

			setShowMenuForTile(null);
		},
		[gameMessenger, gameData],
	);

	const handleActionsTooltipOnClose = useCallback(() => {
		setShowMenuForTile(null);
	}, []);

	return {
		showMenuForTile,
		handleTileClick,
		handleActionsTooltipAction,
		handleActionsTooltipOnClose,
	};
}
