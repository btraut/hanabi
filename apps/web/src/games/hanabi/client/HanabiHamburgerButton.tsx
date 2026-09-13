import Hamburger from '~/games/hanabi/client/icons/Hamburger';

interface Props {
	expanded?: boolean;
	onClick: () => void;
	variant?: 'default' | 'game';
}

export default function HanabiHamburgerButton({
	expanded = false,
	onClick,
	variant = 'default',
}: Props): JSX.Element {
	return (
		<button
			aria-expanded={expanded}
			aria-haspopup="dialog"
			aria-label="Open game menu"
			className={
				variant === 'game'
					? 'hanabi-focus-ring flex h-12 w-14 items-center justify-center rounded-lg border border-hanabi-border text-white hocus:text-hanabi-coral-soft focus:outline-none'
					: 'p-3 text-white hocus:text-red-600 focus:outline-none'
			}
			onClick={onClick}
			type="button"
		>
			<Hamburger size={variant === 'game' ? 24 : 20} color="currentColor" />
		</button>
	);
}
