import Hamburger from 'app/src/games/hanabi/client/icons/Hamburger';
import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import { useState } from 'react';

interface Props {
	onClick: () => void;
}

export default function HanabiHamburgerButton({ onClick }: Props): JSX.Element {
	const isFocusVisible = useFocusVisible();

	const [focused, setFocused] = useState(false);

	return (
		<button
			className="p-3 focus:outline-none"
			onClick={onClick}
			onFocus={() => {
				setFocused(true);
			}}
			onBlur={() => {
				setFocused(false);
			}}
		>
			<Hamburger size={20} color={focused && isFocusVisible ? '#E11D48' : 'white'} />
		</button>
	);
}
