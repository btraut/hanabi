import X from '~/games/hanabi/client/icons/X';
import useFocusVisible from '~/utils/client/useFocusVisible';
import { useState } from 'react';

interface Props {
	onClick: () => void;
}

export default function HanabiXButton({ onClick }: Props): JSX.Element {
	const isFocusVisible = useFocusVisible();

	const [focused, setFocused] = useState(false);

	return (
		<button
			className="p-2 focus:outline-none"
			onClick={onClick}
			onFocus={() => {
				setFocused(true);
			}}
			onBlur={() => {
				setFocused(false);
			}}
		>
			<X color={focused && isFocusVisible ? '#E11D48' : 'white'} size={20} />
		</button>
	);
}
