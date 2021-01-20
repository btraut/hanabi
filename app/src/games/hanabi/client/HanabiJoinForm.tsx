import { useHanabiContext } from 'app/src/games/hanabi/client/HanabiContext';
import HanabiMenuButton from 'app/src/games/hanabi/client/HanabiMenuButton';
import HanabiTextInput from 'app/src/games/hanabi/client/HanabiTextInput';
import { ChangeEvent, FormEvent, useCallback, useState } from 'react';

export default function HanabiJoinForm(): JSX.Element {
	const { game } = useHanabiContext();

	const [addPlayerError, setAddPlayerError] = useState('');

	const [nameValue, setNameValue] = useState('');
	const handleNameInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
		setNameValue(event.target.value);
	}, []);

	const handleAddPlayerSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (game && nameValue) {
			try {
				await game.join(nameValue);
			} catch (error) {
				setAddPlayerError(error?.message || '');
			}
		}
	};

	return (
		<>
			{addPlayerError && (
				<p className="mb-10 text-lg font-bold bg-red-900 text-white px-2 py-1">{addPlayerError}</p>
			)}
			<form onSubmit={handleAddPlayerSubmit}>
				<div className="mb-10 grid grid-cols-form gap-4 items-center w-full">
					<label
						className="text-white font-bold text-2xl justify-end"
						htmlFor="HanabiJoinForm-Name"
					>
						Your Name:
					</label>
					<HanabiTextInput
						id="HanabiJoinForm-Name"
						value={nameValue}
						onChange={handleNameInputChange}
					/>
				</div>
				<div className="flex justify-center">
					<HanabiMenuButton label="Join" />
				</div>
			</form>
		</>
	);
}
