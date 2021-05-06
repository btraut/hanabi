import HanabiCheckbox from 'app/src/games/hanabi/client/design-system/HanabiCheckbox';
import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { ChangeEvent, useCallback, useEffect, useState } from 'react';

interface Props {
	allowDragging: boolean;
	label?: string;
}

export default function HanabiAllowDraggingForm({
	allowDragging,
	label = 'Allow Tile Reording:',
}: Props): JSX.Element {
	const game = useHanabiGame();

	const [displayedAllowDragging, setDisplayedAllowDragging] = useState(allowDragging);

	// This will set the local input value optimistically and also update the
	// server.
	const handleAllowDraggingChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			const newAllowDragging = event.target.checked;
			setDisplayedAllowDragging(newAllowDragging);

			game.changeSettings({
				allowDragging: newAllowDragging,
			});
		},
		[game],
	);

	// If the server sends a different ruleSet, replace our local one.
	useEffect(() => {
		setDisplayedAllowDragging(allowDragging);
	}, [allowDragging]);

	return (
		<div className="grid grid-flow-col gap-3 justify-center items-center">
			{label && (
				<label
					htmlFor="allow-dragging-checkbox"
					className="text-lg font-bold truncate text-center text-white cursor-pointer select-none"
				>
					{label}
				</label>
			)}
			<HanabiCheckbox
				id="allow-dragging-checkbox"
				checked={displayedAllowDragging}
				onChange={handleAllowDraggingChange}
			/>
		</div>
	);
}
