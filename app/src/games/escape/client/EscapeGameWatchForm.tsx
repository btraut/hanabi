import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { FormEvent, useRef, useState } from 'react';
import { useHistory } from 'react-router';

export default function EscapeGameWatchForm(): JSX.Element {
	const gameManager = useEscapeGameManager();
	const history = useHistory();

	const [watchGameError, setWatchGameError] = useState('');

	const codeInputRef = useRef<HTMLInputElement | null>(null);

	const handleWatchGameSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (codeInputRef.current?.value) {
			try {
				await gameManager.watch(codeInputRef.current?.value);
				history.push(`/escape/${gameManager.gameId}`);
			} catch (error) {
				setWatchGameError(error?.message || '');
			}
		}
	};

	return (
		<>
			{watchGameError && <p className="EscapeGame-ErrorText">{watchGameError}</p>}
			<form className="EscapeGame-Form" onSubmit={handleWatchGameSubmit}>
				<div className="EscapeGame-FormContainer">
					<label className="EscapeGame-TextEntryLabel" htmlFor="EscapeGameWatchForm-Code">
						Code:
					</label>
					<input
						className="EscapeGame-TextEntryInput"
						id="EscapeGameWatchForm-Code"
						ref={codeInputRef}
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
