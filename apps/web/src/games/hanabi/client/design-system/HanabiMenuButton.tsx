import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { forwardRef, SyntheticEvent } from 'react';

interface Props {
	onClick?: (event: SyntheticEvent) => void;
	label: string;
	disabled?: boolean;
}

function HanabiMenuButton({ onClick, label, disabled = false }: Props, ref: any): JSX.Element {
	const isFocusVisible = useFocusVisible();

	return (
		<button
			className={classNames(
				'block px-5 py-3 bg-gray-800 text-center uppercase font-bold rounded-xl border-4 duration-100 focus:outline-none select-none',
				disabled
					? 'border-gray-500 cursor-default text-gray-500'
					: 'border-white cursor-pointer text-white hover:bg-red-600 active:scale-95',
				{
					'focus:border-red-600': isFocusVisible,
				},
			)}
			onClick={onClick}
			disabled={disabled}
			ref={ref}
		>
			{label}
		</button>
	);
}

export default forwardRef<HTMLButtonElement, Props>(HanabiMenuButton);
