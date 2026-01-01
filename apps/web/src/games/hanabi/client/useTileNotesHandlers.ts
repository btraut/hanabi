// useTileNotesHandlers is basically a bunch of code that was inline to
// HanabiBoard, but crowded up that component. It defines the data and handlers
// pertaining to hovering over a tile to see its notes.

import { useGameData } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiTileNotes } from '@hanabi/shared';
import { useCallback, useState } from 'react';

type NotesDetails = {
	tileId: string;
	notes: HanabiTileNotes | undefined;
	coords: {
		top: number;
		left: number;
	};
};

export default function useTileNotesHandlers(): {
	showNotesForTile: NotesDetails | null;
	hideNotesForTile: () => void;
	handleTileMouseOver: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	handleTileMouseOut: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
	handleTileMouseDown: (event: React.MouseEvent<HTMLDivElement>, tileId: string) => void;
} {
	const gameData = useGameData();

	const [showNotesForTile, setShowNotesForTile] = useState<NotesDetails | null>(null);

	const handleTileMouseOver = useCallback(
		(event: React.MouseEvent<HTMLDivElement>, tileId: string) => {
			const rect = (event.target as any).getBoundingClientRect();

			setShowNotesForTile({
				tileId,
				notes: gameData.tileNotes[tileId],
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + rect.height + window.scrollY,
				},
			});
		},
		[gameData],
	);

	const hideNotesForTile = useCallback(() => {
		console.log('hideNotesForTile');
		setShowNotesForTile(null);
	}, []);

	return {
		showNotesForTile,
		hideNotesForTile,
		handleTileMouseOver,
		handleTileMouseOut: hideNotesForTile,
		handleTileMouseDown: hideNotesForTile,
	};
}
