import { SyntheticEvent } from 'react';

interface Props {
	onClick?: (event: SyntheticEvent) => void;
	label: string;
	disabled?: boolean;
}

export default function HanabiMenuButton({ onClick, label, disabled = false }: Props): JSX.Element {
	let classes =
		'block px-5 py-3 bg-gray-800 text-center uppercase font-bold rounded-xl border-4 transition-all duration-100';

	if (disabled) {
		classes += ' border-gray-500 cursor-default text-gray-500';
	} else {
		classes += ' border-white cursor-pointer text-white hover:bg-red-600 active:scale-95';
	}

	return (
		<button className={classes} onClick={onClick} disabled={disabled}>
			{label}
		</button>
	);
}
