// useTileActionMenuHandlers is basically a bunch of code that was inline to
// HanabiBoard, but crowded up that component. It defines a bunch of data and
// handlers pertaining to clicking on tiles and following action tooltip
// actions.

import { useUserId } from 'app/src/components/SocketContext';
import { useGameData, useGameMessenger } from 'app/src/games/hanabi/client/HanabiGameContext';
import { HanabiTileActionsTooltipType } from 'app/src/games/hanabi/client/HanabiTileActionsTooltip';
import { HanabiTile, HanabiTileColor } from 'app/src/games/hanabi/HanabiGameData';
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
	handleTileClick: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
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
		(event: React.MouseEvent<HTMLDivElement>, tileId: string) => {
			const rect = (event.target as any).getBoundingClientRect();
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
					gameMessenger.discardTile(tile);
					break;
				case 'play':
					gameMessenger.playTile(tile);
					break;
				case 'color':
					gameMessenger.giveColorClue(tileOwner, details?.color ?? tile.color);
					break;
				case 'number':
					gameMessenger.giveNumberClue(tileOwner, tile.number);
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
