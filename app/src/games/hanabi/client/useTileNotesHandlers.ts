// useTileNotesHandlers is basically a bunch of code that was inline to
// HanabiBoard, but crowded up that component. It defines the data and handlers
// pertaining to hovering over a tile to see its notes.

import { HanabiGameData, HanabiTileNotes } from 'app/src/games/hanabi/HanabiGameData';
import { useCallback, useState } from 'react';

type NotesDetails = {
	tileId: string;
	notes: HanabiTileNotes | undefined;
	coords: {
		top: number;
		left: number;
	};
};

export default function useTileNotesHandlers(
	gameData: HanabiGameData,
): {
	showNotesForTile: NotesDetails | null;
	handleTileMouseOver: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	handleTileMouseOut: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
} {
	const [showNotesForTile, setShowNotesForTile] = useState<NotesDetails | null>(null);

	const handleTileMouseOver = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, tileId: string) => {
			const rect = (event.target as any).getBoundingClientRect();

			setShowNotesForTile({
				tileId,
				notes: gameData.tileNotes[tileId],
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + rect.height + 2 + window.scrollY,
				},
			});
		},
		[gameData],
	);

	const handleTileMouseOut = useCallback(
		(_event: React.MouseEvent<HTMLDivElement>, tileId: string) => {
			if (showNotesForTile?.tileId === tileId) {
				setShowNotesForTile(null);
			}
		},
		[showNotesForTile?.tileId],
	);

	return {
		showNotesForTile,
		handleTileMouseOver,
		handleTileMouseOut,
	};
}
