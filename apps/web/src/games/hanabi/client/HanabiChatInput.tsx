import { useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import PaperPlane from '~/games/hanabi/client/icons/PaperPlane';
import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { FormEvent, KeyboardEvent, useCallback, useState } from 'react';

export function isSendableChatMessage(message: string): boolean {
	return message.trim().length > 0;
}

export default function HanabiChatInput({
	variant = 'legacy',
}: {
	variant?: 'desktop' | 'legacy';
}): JSX.Element {
	const gameMessenger = useGameMessenger();
	const isFocusVisible = useFocusVisible();
	const [message, setMessage] = useState('');
	const [isSending, setIsSending] = useState(false);
	const [sendError, setSendError] = useState(false);
	const canSend = isSendableChatMessage(message) && !isSending;

	const sendMessage = useCallback(async () => {
		const trimmedMessage = message.trim();
		if (!trimmedMessage || isSending) return;

		setIsSending(true);
		setSendError(false);
		try {
			await gameMessenger.sendChat(trimmedMessage);
			setMessage('');
		} catch (error: unknown) {
			setSendError(true);
			console.error('Could not send chat message:', error);
		} finally {
			setIsSending(false);
		}
	}, [gameMessenger, isSending, message]);

	const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
		event.preventDefault();
		void sendMessage();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
		if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
			event.preventDefault();
			void sendMessage();
		}
	};

	if (variant === 'legacy') {
		return (
			<form className="grid grid-cols-[1fr_58px] items-stretch gap-3 p-2" onSubmit={handleSubmit}>
				<textarea
					aria-label="Chat message"
					className="resize-none border-2 border-gray-800 bg-gray-100 p-2 text-sm text-black focus:border-red-600 focus:bg-white focus:outline-none"
					onChange={(event) => setMessage(event.target.value)}
					onKeyDown={handleKeyDown}
					rows={1}
					value={message}
				/>
				<button
					className={classNames(
						'block select-none bg-gray-800 text-center font-bold text-white duration-100 hover:bg-red-600 focus:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-45',
						{ 'bg-red-600': isFocusVisible },
					)}
					disabled={!canSend}
					type="submit"
				>
					Send
				</button>
			</form>
		);
	}

	return (
		<form className="hanabi-chat-input" onSubmit={handleSubmit}>
			<div className={classNames('hanabi-chat-field', { 'has-error': sendError })}>
				<textarea
					aria-describedby={sendError ? 'hanabi-chat-send-error' : undefined}
					aria-label="Chat message"
					autoCapitalize="sentences"
					className="hanabi-chat-textarea"
					onChange={(event) => {
						setMessage(event.target.value);
						if (sendError) setSendError(false);
					}}
					onKeyDown={handleKeyDown}
					placeholder="Message the table…"
					rows={1}
					value={message}
				/>
			</div>
			<button
				aria-label={isSending ? 'Sending message' : 'Send message'}
				className="hanabi-chat-send hanabi-focus-ring"
				disabled={!canSend}
				type="submit"
			>
				<PaperPlane size={21} />
			</button>
			{sendError && (
				<p className="hanabi-chat-error" id="hanabi-chat-send-error" role="alert">
					Message didn’t send. Try again.
				</p>
			)}
		</form>
	);
}
