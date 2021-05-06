import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import classNames from 'classnames';
import { ChangeEventHandler, forwardRef } from 'react';

interface Props {
	onChange: ChangeEventHandler<HTMLInputElement>;
	checked: boolean;
}

function HanabiCheckbox({ onChange, checked }: Props, ref: any): JSX.Element {
	const isFocusVisible = useFocusVisible();

	return (
		<div className="relative">
			{checked && (
				<div className="absolute inset-0 grid justify-center mt-0.5 text-white pointer-events-none text-xl font-bold">
					✓
				</div>
			)}
			<input
				type="checkbox"
				checked={checked}
				onChange={onChange}
				ref={ref}
				className={classNames(
					'appearance-none bg-gray-800 border-4 duration-100 w-8 h-8',
					'border-white hover:bg-red-600 active:scale-95 rounded-md cursor-pointer',
					{
						'focus:border-red-600': isFocusVisible,
					},
				)}
			/>
		</div>
	);
}

export default forwardRef<HTMLInputElement, Props>(HanabiCheckbox);
