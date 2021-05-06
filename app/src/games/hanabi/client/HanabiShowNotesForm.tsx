import HanabiCheckbox from 'app/src/games/hanabi/client/design-system/HanabiCheckbox';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

interface Props {
	showNotes: boolean;
}

export default function HanabiShowNotesForm({ showNotes }: Props): JSX.Element {
	const game = useHanabiGame();

	const [displayedShowNotes, setDisplayedShowNotes] = useState(showNotes);

	// This will set the local input value optimistically and also update the
	// server.
	const handleShowNotesChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const newShowNotes = event.target.checked;
			setDisplayedShowNotes(newShowNotes);

			game.changeSettings({
				showNotes: newShowNotes,
			});
		},
		[game],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedShowNotes(showNotes);
	}, [showNotes]);

	return (
		<div className="grid grid-flow-col gap-3 justify-center items-center">
			<label className="text-lg font-bold truncate text-center text-white">Show Notes:</label>
			<HanabiCheckbox checked={displayedShowNotes} onChange={handleShowNotesChange} />
		</div>
	);
}
