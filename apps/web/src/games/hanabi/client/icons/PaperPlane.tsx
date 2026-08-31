import { HanabiIconProps } from '~/games/hanabi/client/icons/HanabiIconProps';

export default function PaperPlane({ className, size = 20, title }: HanabiIconProps): JSX.Element {
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
				d="M3.2 4.1 21 12 3.2 19.9l2.15-6.35L14 12l-8.65-1.55L3.2 4.1Z"
				fill="none"
				stroke="currentColor"
				strokeLinejoin="round"
				strokeWidth="1.7"
			/>
		</svg>
	);
}
