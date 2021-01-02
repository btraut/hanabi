import { useEscapeGame } from 'app/src/games/escape/client/EscapeGameContext';
import { FormEvent, useRef, useState } from 'react';

export default function EscapeGameJoinForm(): JSX.Element {
	const game = useEscapeGame();

	const [addPlayerError, setAddPlayerError] = useState('');

	const nameInputRef = useRef<HTMLInputElement | null>(null);

	const handleAddPlayerSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (game && nameInputRef.current?.value) {
			try {
				await game.join(nameInputRef.current?.value);
			} catch (error) {
				setAddPlayerError(error?.message || '');
			}
		}
	};

	return (
		<>
			{addPlayerError && <p className="EscapeGame-ErrorText">{addPlayerError}</p>}
			<form className="EscapeGame-Form" onSubmit={handleAddPlayerSubmit}>
				<div className="EscapeGame-FormContainer">
					<label className="EscapeGame-TextEntryLabel" htmlFor="EscapeGameJoinForm-Name">
						Name:
					</label>
					<input
						className="EscapeGame-TextEntryInput"
						id="EscapeGameJoinForm-Name"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="EscapeGame-FormButtons">
					<input className="EscapeGame-GameAction" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
