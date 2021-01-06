import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { FormEvent, useRef, useState } from 'react';

export default function HanabiJoinForm(): JSX.Element {
	const game = useHanabiGame();

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
			{addPlayerError && <p className="Hanabi-ErrorText">{addPlayerError}</p>}
			<form className="Hanabi-Form" onSubmit={handleAddPlayerSubmit}>
				<div className="Hanabi-FormContainer">
					<label className="Hanabi-TextEntryLabel" htmlFor="HanabiJoinForm-Name">
						Name:
					</label>
					<input
						className="Hanabi-TextEntryInput"
						id="HanabiJoinForm-Name"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="Hanabi-FormButtons">
					<input className="Hanabi-GameAction" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
