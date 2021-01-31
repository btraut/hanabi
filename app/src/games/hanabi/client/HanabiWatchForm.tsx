import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiTextInput from 'app/src/games/hanabi/client/HanabiTextInput';
import { ChangeEvent, FormEvent, useCallback, useState } from 'react';
import { useHistory } from 'react-router';

export default function HanabiWatchForm(): JSX.Element {
	const hanabiContext = useHanabiContext();
	const history = useHistory();

	const [watchGameError, setWatchGameError] = useState('');

	const [codeValue, setCodeValue] = useState('');
	const handleCodeInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setCodeValue(event.target.value);
	}, []);

	const handleWatchGameSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (codeValue) {
			try {
				const watchedGame = await hanabiContext.watch(codeValue);
				history.push(`/hanabi/${watchedGame.code}`);
			} catch (error) {
				setWatchGameError(error?.message || '');
			}
		}
	};

	return (
		<div className="w-screen min-h-screen p-20 grid grid-flow-row gap-10 content-center justify-center">
			<h1 className="mb-10 text-8xl italic text-white text-center text-shadow">Hanabi</h1>
			{watchGameError && (
				<p className="mb-10 text-lg font-bold bg-red-900 text-white px-2 py-1">{watchGameError}</p>
			)}
			<form onSubmit={handleWatchGameSubmit}>
				<div className="mb-10 grid grid-cols-form gap-4 items-center w-full">
					<label
						className="text-white font-bold text-2xl justify-end"
						htmlFor="HanabiGameWatchForm-Code"
					>
						Game Code:
					</label>
					<HanabiTextInput
						id="HanabiGameWatchForm-Code"
						value={codeValue}
						onChange={handleCodeInputChange}
					/>
				</div>
				<div className="flex justify-center">
					<HanabiMenuButton label="Join" />
				</div>
			</form>
		</div>
	);
}
