import { HanabiIconProps } from '~/games/hanabi/client/icons/HanabiIconProps';

export default function CardStack({ className, size = 20, title }: HanabiIconProps): JSX.Element {
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
			<rect
				fill="none"
				height="14"
				rx="2"
				stroke="currentColor"
				strokeWidth="1.7"
				width="12"
				x="7"
				y="4"
			/>
			<path
				d="M5 7.5v10A2.5 2.5 0 0 0 7.5 20H16"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.7"
			/>
			<path
				d="M10 8h6M10 11h4"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeWidth="1.7"
			/>
		</svg>
	);
}
