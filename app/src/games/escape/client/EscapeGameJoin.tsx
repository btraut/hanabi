import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { FormEvent, useRef, useState } from 'react';
import { useHistory } from 'react-router';

interface Props {
	gameManager: EscapeGameManager;
}

export default function EscapeGameJoin({ gameManager }: Props): JSX.Element {
	const history = useHistory();

	const [joinGameError, setJoinGameError] = useState('');

	const codeInputRef = useRef<HTMLInputElement | null>(null);
	const nameInputRef = useRef<HTMLInputElement | null>(null);

	const handleJoinGameSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (codeInputRef.current?.value && nameInputRef.current?.value) {
			try {
				await gameManager.join(codeInputRef.current?.value, nameInputRef.current?.value);
				history.push(`/escape/${gameManager.gameId}`);
			} catch (error) {
				setJoinGameError(error?.message || '');
			}
		}
	};

	return (
		<>
			{joinGameError && <p className="EscapeGameJoin-ErrorText">{joinGameError}</p>}
			<form className="EscapeGameJoin-GameForm" onSubmit={handleJoinGameSubmit}>
				<div className="EscapeGameJoin-GameFormContainer">
					<label className="EscapeGameJoin-TextEntryLabel" htmlFor="EscapeGameJoin-Code">
						Code:
					</label>
					<input
						className="EscapeGameJoin-TextEntryInput"
						id="EscapeGameJoin-Code"
						ref={codeInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
					<label className="EscapeGameJoin-TextEntryLabel" htmlFor="EscapeGameJoin-Name">
						Name:
					</label>
					<input
						className="EscapeGameJoin-TextEntryInput"
						id="EscapeGameJoin-Name"
						ref={nameInputRef}
						type="text"
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="EscapeGameJoin-GameFormButtons">
					<input className="EscapeGameJoin-SubmitButton" type="submit" value="Join" />
				</div>
			</form>
		</>
	);
}
