import { useEscapeContext } from 'app/src/games/escape/client/EscapeContext';
import { FormEvent, useRef, useState } from 'react';
import { useHistory } from 'react-router';

export default function EscapeWatchForm(): JSX.Element {
	const escapeContext = useEscapeContext();
	const history = useHistory();

	const [watchGameError, setWatchGameError] = useState('');

	const codeInputRef = useRef<HTMLInputElement | null>(null);

	const handleWatchGameSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (codeInputRef.current?.value) {
			try {
				const watchedGame = await escapeContext.watch(codeInputRef.current?.value);
				history.push(`/escape/${watchedGame.id}`);
			} catch (error) {
				setWatchGameError(error?.message || '');
			}
		}
	};

	return (
		<>
			{watchGameError && <p className="Escape-ErrorText">{watchGameError}</p>}
			<form className="Escape-Form" onSubmit={handleWatchGameSubmit}>
				<div className="Escape-FormContainer">
					<label className="Escape-TextEntryLabel" htmlFor="EscapeGameWatchForm-Code">
						Code:
					</label>
					<input
						className="Escape-TextEntryInput"
						id="EscapeGameWatchForm-Code"
						ref={codeInputRef}
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
