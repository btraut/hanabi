import { useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import useFocusVisible from '~/utils/client/useFocusVisible';
import PaperPlane from '~/games/hanabi/client/icons/PaperPlane';
import classNames from 'classnames';
import { KeyboardEvent, useCallback, useRef } from 'react';

export default function HanabiChatInput({
	variant = 'legacy',
}: {
	variant?: 'desktop' | 'legacy';
}): JSX.Element {
	const gameMessenger = useGameMessenger();
	const isFocusVisible = useFocusVisible();

	const inputRef = useRef<HTMLInputElement | null>(null);

	const sendMessage = useCallback(() => {
		if (!inputRef.current) {
			return;
		}

		const message = inputRef.current.value;
		inputRef.current.value = '';

		void gameMessenger.sendChat(message).catch((error: unknown) => {
			console.error('Could not send chat message:', error);
		});
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
		<div className="grid items-stretch p-2" style={{ gridTemplateColumns: '1fr auto' }}>
			<input
				aria-label="Chat message"
				className={classNames('p-2 text-sm focus:outline-none', {
					'border-2 border-gray-800 bg-gray-100 text-black focus:border-red-600 focus:bg-white':
						variant === 'legacy',
					'border border-hanabi-border bg-hanabi-table text-hanabi-text placeholder:text-hanabi-text-muted focus:border-hanabi-coral':
						variant === 'desktop',
				})}
				placeholder={variant === 'desktop' ? 'Send a message…' : undefined}
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
				aria-label="Send message"
				className={classNames(
					'block cursor-pointer select-none text-center font-bold text-white duration-100 focus:outline-none active:scale-95',
					{
						'bg-gray-800 hover:bg-red-600': variant === 'legacy',
						'bg-hanabi-coral hover:bg-hanabi-coral-soft': variant === 'desktop',
						'bg-red-600': isFocusVisible && variant === 'legacy',
						'ring-2 ring-hanabi-focus ring-inset': isFocusVisible && variant === 'desktop',
					},
				)}
				style={{
					borderTopRightRadius: 4,
					borderBottomRightRadius: 4,
					padding: '0 12px 0 8px',
				}}
				onClick={sendMessage}
			>
				{variant === 'desktop' ? <PaperPlane size={18} /> : 'Send'}
			</button>
		</div>
	);
}
