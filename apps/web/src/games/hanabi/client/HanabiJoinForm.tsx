import HanabiMenuButton from '~/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiTextInput from '~/games/hanabi/client/design-system/HanabiTextInput';
import { useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import LOCAL_STORAGE_KEYS from '~/games/hanabi/client/HanabiLocalStorageManager';
import { useLocalStorage } from '~/games/hanabi/client/useLocalStorage';
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from 'react';

export default function HanabiJoinForm(): JSX.Element {
	const gameMessenger = useGameMessenger();

	const [addPlayerError, setAddPlayerError] = useState('');

	const [nameValue, setNameValue] = useLocalStorage(LOCAL_STORAGE_KEYS.USER_NAME, '');

	const handleNameInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setNameValue(event.target.value);
		},
		[setNameValue],
	);

	const handleAddPlayerSubmit = async (event: FormEvent) => {
		event.preventDefault();

		if (gameMessenger && nameValue) {
			try {
				await gameMessenger.join(nameValue);
				setNameValue(nameValue);
			} catch (error) {
				setAddPlayerError(error instanceof Error ? error.message : '');
			}
		}
	};

	const textInputRef = useRef<HTMLInputElement | null>(null);
	const joinButtonRef = useRef<HTMLButtonElement | null>(null);

	useEffect(() => {
		if (!textInputRef.current?.value) {
			textInputRef.current?.focus();
		} else {
			joinButtonRef.current?.focus();
		}
	}, []);

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
						ref={textInputRef}
					/>
				</div>
				<div className="flex justify-center">
					<HanabiMenuButton label="Join" ref={joinButtonRef} />
				</div>
			</form>
		</>
	);
}
