import { HanabiIconProps } from '~/games/hanabi/client/icons/HanabiIconProps';

export default function Star({ className, size = 20, title }: HanabiIconProps): JSX.Element {
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
				d="m12 2.6 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.96l-5.7 3 1.09-6.35-4.62-4.5 6.38-.93L12 2.6Z"
				fill="currentColor"
			/>
		</svg>
	);
}
