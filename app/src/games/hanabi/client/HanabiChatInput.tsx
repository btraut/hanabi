import { useGameMessenger } from 'app/src/games/hanabi/client/HanabiGameContext';
import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import classNames from 'classnames';
import { KeyboardEvent, useCallback, useRef } from 'react';

export default function HanabiChatInput(): JSX.Element {
	const gameMessenger = useGameMessenger();
	const isFocusVisible = useFocusVisible();

	const inputRef = useRef<HTMLInputElement | null>(null);

	const sendMessage = useCallback(() => {
		if (!inputRef.current) {
			return;
		}

		const message = inputRef.current.value;
		inputRef.current.value = '';

		gameMessenger.sendChat(message);
	}, [gameMessenger]);

	const handleKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === 'Enter') {
				sendMessage();
			}
		},
		[sendMessage],
	);

	return (
		<div className="p-2 grid items-stretch" style={{ gridTemplateColumns: '1fr auto' }}>
			<input
				className="p-2 bg-gray-100 border-2 border-gray-800 text-black text-sm focus:outline-none focus:border-red-600 focus:bg-white"
				style={{
					borderTopLeftRadius: 4,
					borderBottomLeftRadius: 4,
				}}
				type="text"
				autoCorrect="off"
				autoCapitalize="none"
				onKeyDown={handleKeyDown}
				ref={inputRef}
			/>
			<button
				className={classNames(
					'block bg-gray-800 text-center font-bold duration-100 focus:outline-none select-none',
					'cursor-pointer text-white hover:bg-red-600 active:scale-95',
					{
						'focus:bg-red-600': isFocusVisible,
					},
				)}
				style={{
					borderTopRightRadius: 4,
					borderBottomRightRadius: 4,
					padding: '0 12px 0 8px',
				}}
				onClick={sendMessage}
			>
				Send
			</button>
		</div>
	);
}
