import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import { FormEvent, useRef, useState } from 'react';
import { useHistory } from 'react-router';

export default function HanabiWatchForm(): JSX.Element {
	const hanabiContext = useHanabiContext();
	const history = useHistory();

	const [watchGameError, setWatchGameError] = useState('');

	const codeInputRef = useRef<HTMLInputElement | null>(null);

	const handleWatchGameSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (codeInputRef.current?.value) {
			try {
				const watchedGame = await hanabiContext.watch(codeInputRef.current?.value);
				history.push(`/hanabi/${watchedGame.id}`);
			} catch (error) {
				setWatchGameError(error?.message || '');
			}
		}
	};

	return (
		<>
			{watchGameError && <p className="Hanabi-ErrorText">{watchGameError}</p>}
			<form className="Hanabi-Form" onSubmit={handleWatchGameSubmit}>
				<div className="Hanabi-FormContainer">
					<label className="Hanabi-TextEntryLabel" htmlFor="HanabiGameWatchForm-Code">
						Code:
					</label>
					<input
						className="Hanabi-TextEntryInput"
						id="HanabiGameWatchForm-Code"
						ref={codeInputRef}
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
