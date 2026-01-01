import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { ChangeEventHandler, forwardRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
	id?: string;
	onChange: ChangeEventHandler<HTMLInputElement>;
	checked: boolean;
}

function HanabiCheckbox({ id, onChange, checked }: Props, ref: any): JSX.Element {
	const isFocusVisible = useFocusVisible();

	const [finalId] = useState(id ?? `dropdown-${uuidv4()}`);

	return (
		<div className="relative h-8">
			{checked && (
				<div className="absolute inset-0 grid justify-center items-center text-white pointer-events-none text-xl font-bold h-8">
					✓
				</div>
			)}
			<input
				id={finalId}
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
