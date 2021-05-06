import { useHanabiGame } from 'app/src/games/hanabi/client/HanabiContext';
import { KeyboardEvent, useCallback, useRef } from 'react';

export default function HanabiChatInput(): JSX.Element {
	const game = useHanabiGame();

	const inputRef = useRef<HTMLInputElement | null>(null);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (!inputRef.current) {
				return;
			}

			if (event.key === 'Enter') {
				const message = inputRef.current.value;
				inputRef.current.value = '';

				game.sendChat(message);
			}
		},
		[game],
	);

	return (
		<div className="p-2">
			<input
				className="block w-full rounded-md p-2 bg-gray-100 border-2 border-gray-600 text-black text-sm focus:outline-none focus:border-red-600 focus:bg-white"
				type="text"
				autoCorrect="off"
				autoCapitalize="none"
				onKeyDown={handleKeyDown}
				ref={inputRef}
			/>
		</div>
	);
}
