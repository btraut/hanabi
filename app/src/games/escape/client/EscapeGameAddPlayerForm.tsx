import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { FormEvent, useRef, useState } from 'react';
import { useHistory } from 'react-router';

interface Props {
	gameManager: EscapeGameManager;
}

export default function EscapeGameAddPlayerForm({ gameManager }: Props): JSX.Element {
	const [addPlayerError, setAddPlayerError] = useState('');

	const nameInputRef = useRef<HTMLInputElement | null>(null);

	const handleAddPlayerSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (nameInputRef.current?.value) {
			try {
				await gameManager.addPlayer(nameInputRef.current?.value);
			} catch (error) {
				setAddPlayerError(error?.message || '');
			}
		}
	};

	return (
		<>
			{addPlayerError && <p className="EscapeGameWatchForm-ErrorText">{addPlayerError}</p>}
			<form className="EscapeGameWatchForm-GameForm" onSubmit={handleAddPlayerSubmit}>
				<div className="EscapeGameWatchForm-GameFormContainer">
					<label className="EscapeGameWatchForm-TextEntryLabel" htmlFor="EscapeGameWatchForm-Code">
						Code:
					</label>
					<input
						className="EscapeGameWatchForm-TextEntryInput"
						id="EscapeGameWatchForm-Code"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="EscapeGameWatchForm-GameFormButtons">
					<input className="EscapeGameWatchForm-SubmitButton" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
