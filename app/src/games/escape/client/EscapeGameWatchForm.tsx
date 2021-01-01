import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { FormEvent, useRef, useState } from 'react';
import { useHistory } from 'react-router';

interface Props {
	gameManager: EscapeGameManager;
}

export default function EscapeGameWatchForm({ gameManager }: Props): JSX.Element {
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
			{watchGameError && <p className="EscapeGameWatchForm-ErrorText">{watchGameError}</p>}
			<form className="EscapeGameWatchForm-GameForm" onSubmit={handleWatchGameSubmit}>
				<div className="EscapeGameWatchForm-GameFormContainer">
					<label className="EscapeGameWatchForm-TextEntryLabel" htmlFor="EscapeGameWatchForm-Code">
						Code:
					</label>
					<input
						className="EscapeGameWatchForm-TextEntryInput"
						id="EscapeGameWatchForm-Code"
						ref={codeInputRef}
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
