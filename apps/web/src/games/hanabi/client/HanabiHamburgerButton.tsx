import Hamburger from '~/games/hanabi/client/icons/Hamburger';
import useFocusVisible from '~/utils/client/useFocusVisible';
import { useState } from 'react';

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
	const isFocusVisible = useFocusVisible();

	const [focused, setFocused] = useState(false);

	return (
		<button
			aria-expanded={expanded}
			aria-haspopup="dialog"
			aria-label="Open game menu"
			className={
				variant === 'game'
					? 'hanabi-focus-ring flex h-12 w-14 items-center justify-center rounded-lg border border-hanabi-border focus:outline-none'
					: 'p-3 focus:outline-none'
			}
			onClick={onClick}
			onFocus={() => {
				setFocused(true);
			}}
			onBlur={() => {
				setFocused(false);
			}}
			type="button"
		>
			<Hamburger
				size={variant === 'game' ? 24 : 20}
				color={focused && isFocusVisible ? '#E11D48' : 'white'}
			/>
		</button>
	);
}
