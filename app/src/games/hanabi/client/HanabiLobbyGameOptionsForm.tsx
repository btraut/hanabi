import HanabiCheckbox from 'app/src/games/hanabi/client/design-system/HanabiCheckbox';
import { useGameMessenger } from 'app/src/games/hanabi/client/HanabiContext';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
	checked: boolean;
	label: string;
	settingsKey: 'allowDragging' | 'showNotes' | 'criticalGameOver';
}

export default function HanabiLobbyGameOptionsForm({
	checked,
	label,
	settingsKey,
}: Props): JSX.Element {
	const gameMessenger = useGameMessenger();

	const [displayedChecked, setDisplayedChecked] = useState(checked);

	const [id] = useState(uuidv4());

	// This will set the local input value optimistically and also update the
	// server.
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const newAllowDragging = event.target.checked;
			setDisplayedChecked(newAllowDragging);

			gameMessenger.changeSettings({
				[settingsKey]: newAllowDragging,
			});
		},
		[gameMessenger, settingsKey],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedChecked(checked);
	}, [checked]);

	return (
		<div className="grid grid-flow-col gap-3 justify-start items-center">
			<HanabiCheckbox id={id} checked={displayedChecked} onChange={handleChange} />
			<label
				htmlFor={id}
				className="text-lg font-bold truncate text-center text-white cursor-pointer select-none"
			>
				{label}
			</label>
		</div>
	);
}
