// useTileNotesHandlers is basically a bunch of code that was inline to
// HanabiBoard, but crowded up that component. It defines the data and handlers
// pertaining to hovering over a tile to see its notes.

import { useBoardData } from '~/games/hanabi/client/HanabiGameContext';
import { HanabiTileNotes } from '@hanabi/shared';
import { useCallback, useState } from 'react';

type NotesDetails = {
	tileId: string;
	position: 'above' | 'below';
	notes: HanabiTileNotes | undefined;
	coords: {
		top: number;
		left: number;
	};
};

export default function useTileNotesHandlers(): {
	showNotesForTile: NotesDetails | null;
	hideNotesForTile: () => void;
	handleTileMouseOver: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	handleTileMouseOut: () => void;
	handleTileMouseDown: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	handleTileLongPress: (element: HTMLElement, tileId: string) => void;
} {
	const gameData = useBoardData();

	const [showNotesForTile, setShowNotesForTile] = useState<NotesDetails | null>(null);

	const showNotes = useCallback(
		(element: HTMLElement, tileId: string, position: 'above' | 'below') => {
			if (!gameData.showNotes) return;
			const rect = element.getBoundingClientRect();

			setShowNotesForTile({
				tileId,
				position,
				notes: gameData.tileNotes[tileId],
				coords: {
					left: rect.x + rect.width / 2,
					top: rect.y + (position === 'below' ? rect.height : 0) + window.scrollY,
				},
			});
		},
		[gameData],
	);

	const handleTileMouseOver = useCallback(
		(event: React.MouseEvent<HTMLElement>, tileId: string) => {
			showNotes(event.currentTarget, tileId, 'below');
		},
		[showNotes],
	);

	const handleTileLongPress = useCallback(
		(element: HTMLElement, tileId: string) => showNotes(element, tileId, 'above'),
		[showNotes],
	);

	const hideNotesForTile = useCallback(() => {
		setShowNotesForTile(null);
	}, []);

	return {
		showNotesForTile,
		hideNotesForTile,
		handleTileMouseOver,
		handleTileMouseOut: hideNotesForTile,
		handleTileMouseDown: hideNotesForTile,
		handleTileLongPress,
	};
}
