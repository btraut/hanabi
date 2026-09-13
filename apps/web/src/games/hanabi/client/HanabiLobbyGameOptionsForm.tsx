import HanabiCheckbox from '~/games/hanabi/client/design-system/HanabiCheckbox';
import { useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

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

	const [id] = useState(() => crypto.randomUUID());

	// This will set the local input value optimistically and also update the
	// server.
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const newAllowDragging = event.target.checked;
			setDisplayedChecked(newAllowDragging);

			void gameMessenger
				.changeSettings({
					[settingsKey]: newAllowDragging,
				})
				.catch((error: unknown) => {
					console.error('Could not change the game options:', error);
				});
		},
		[gameMessenger, settingsKey],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedChecked(checked);
	}, [checked]);

	return (
		<div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 items-start">
			<HanabiCheckbox id={id} checked={displayedChecked} onChange={handleChange} />
			<label
				htmlFor={id}
				className="text-lg font-bold text-white cursor-pointer select-none leading-6"
			>
				{label}
			</label>
		</div>
	);
}
