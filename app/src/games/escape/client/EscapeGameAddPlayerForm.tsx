import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { FormEvent, useRef, useState } from 'react';

export default function EscapeGameAddPlayerForm(): JSX.Element {
	const gameManager = useEscapeGameManager();

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
			{addPlayerError && <p className="EscapeGameAddPlayerForm-ErrorText">{addPlayerError}</p>}
			<form className="EscapeGameAddPlayerForm-GameForm" onSubmit={handleAddPlayerSubmit}>
				<div className="EscapeGameAddPlayerForm-GameFormContainer">
					<label
						className="EscapeGameAddPlayerForm-TextEntryLabel"
						htmlFor="EscapeGameAddPlayerForm-Code"
					>
						Code:
					</label>
					<input
						className="EscapeGameAddPlayerForm-TextEntryInput"
						id="EscapeGameAddPlayerForm-Code"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="EscapeGameAddPlayerForm-GameFormButtons">
					<input className="EscapeGameAddPlayerForm-SubmitButton" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
