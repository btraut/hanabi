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
	// TODO: Focus doesn't actually work right now because of custom styles.
	const isFocusVisible = useFocusVisible();

	const [finalId] = useState(id ?? `dropdown-${uuidv4()}`);

	return (
		<div
			className={classNames(
				'HanabiDropdown grid grid-flow-col items-center py-2 px-3 bg-gray-800 border-4 duration-100',
				'border-white hover:bg-red-600 active:scale-95 rounded-xl cursor-pointer',
				{
					'focus:border-red-600': isFocusVisible,
				},
			)}
		>
			<select
				id={finalId}
				onChange={onChange}
				ref={ref}
				value={value}
				className="appearance-none focus:outline-none bg-transparent text-white text-center font-bold cursor-pointer"
			>
				{Object.keys(options).map((label) => (
					<option key={options[label]} value={options[label]}>
						{label}
					</option>
				))}
			</select>
		</div>
	);
}

export default forwardRef<HTMLSelectElement, Props>(HanabiDropdown);
