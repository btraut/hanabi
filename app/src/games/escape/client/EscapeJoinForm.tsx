import { useEscapeGame } from 'app/src/games/escape/client/EscapeContext';
import { FormEvent, useRef, useState } from 'react';

export default function EscapeJoinForm(): JSX.Element {
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
			{addPlayerError && <p className="Escape-ErrorText">{addPlayerError}</p>}
			<form className="Escape-Form" onSubmit={handleAddPlayerSubmit}>
				<div className="Escape-FormContainer">
					<label className="Escape-TextEntryLabel" htmlFor="EscapeJoinForm-Name">
						Name:
					</label>
					<input
						className="Escape-TextEntryInput"
						id="EscapeJoinForm-Name"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="Escape-FormButtons">
					<input className="Escape-GameAction" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
