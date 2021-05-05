import useFocusVisible from 'app/src/utils/client/useFocusVisible';
import classNames from 'classnames';
import { ChangeEventHandler, forwardRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface Props {
	id?: string;
	options: { [label: string]: string };
	onChange: ChangeEventHandler<HTMLSelectElement>;
	value: string;
}

function HanabiDropdown({ id, onChange, options, value }: Props, ref: any): JSX.Element {
	const isFocusVisible = useFocusVisible();

	const [finalId] = useState(id ?? `dropdown-${uuidv4()}`);

	return (
		<select
			id={finalId}
			onChange={onChange}
			ref={ref}
			value={value}
			className={classNames(
				'block p-2 bg-gray-800 text-center font-bold rounded-xl border-4 duration-100 focus:outline-none',
				'border-white cursor-pointer text-white hover:bg-red-600 active:scale-95',
				{
					'focus:border-red-600': isFocusVisible,
				},
			)}
		>
			{Object.keys(options).map((label) => (
				<option key={options[label]} value={options[label]}>
					{label}
				</option>
			))}
		</select>
	);
}

export default forwardRef<HTMLSelectElement, Props>(HanabiDropdown);
