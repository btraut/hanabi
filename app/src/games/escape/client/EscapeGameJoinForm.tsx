import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { FormEvent, useRef, useState } from 'react';

export default function EscapeGameJoinForm(): JSX.Element {
	const gameManager = useEscapeGameManager();

	const [addPlayerError, setAddPlayerError] = useState('');

	const nameInputRef = useRef<HTMLInputElement | null>(null);

	const handleAddPlayerSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (nameInputRef.current?.value) {
			try {
				await gameManager.joinGame(nameInputRef.current?.value);
			} catch (error) {
				setAddPlayerError(error?.message || '');
			}
		}
	};

	return (
		<>
			{addPlayerError && <p className="EscapeGameJoinForm-ErrorText">{addPlayerError}</p>}
			<form className="EscapeGameJoinForm-GameForm" onSubmit={handleAddPlayerSubmit}>
				<div className="EscapeGameJoinForm-GameFormContainer">
					<label className="EscapeGameJoinForm-TextEntryLabel" htmlFor="EscapeGameJoinForm-Code">
						Code:
					</label>
					<input
						className="EscapeGameJoinForm-TextEntryInput"
						id="EscapeGameJoinForm-Code"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="EscapeGameJoinForm-GameFormButtons">
					<input className="EscapeGameJoinForm-SubmitButton" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
