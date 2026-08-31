import { HanabiIconProps } from '~/games/hanabi/client/icons/HanabiIconProps';

export default function ChatBubble({ className, size = 20, title }: HanabiIconProps): JSX.Element {
	return (
		<svg
			aria-hidden={title ? undefined : true}
			className={className}
			focusable="false"
			height={size}
			role={title ? 'img' : undefined}
			viewBox="0 0 24 24"
			width={size}
		>
			{title && <title>{title}</title>}
			<path
				d="M4 5.5h16v11H9l-5 3v-14Z"
				fill="none"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth="1.7"
			/>
			<path
				d="M8 9.5h8M8 12.5h5"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.7"
			/>
		</svg>
	);
}
