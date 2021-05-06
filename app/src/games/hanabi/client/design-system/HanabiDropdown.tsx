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
		<div className="grid justify-start">
			<div className="inline-block relative">
				<select
					id={finalId}
					onChange={onChange}
					ref={ref}
					value={value}
					className={classNames(
						'appearance-none focus:outline-none bg-transparent text-white text-center font-bold cursor-pointer',
						'py-2 pl-3 pr-10 bg-gray-800 border-4 duration-100',
						'border-white hover:bg-red-600 active:scale-95 rounded-xl cursor-pointer',
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
				<div className="absolute right-4 top-0 bottom-0 pointer-events-none flex items-center">
					<div
						style={{
							borderLeftColor: 'transparent',
							borderRightColor: 'transparent',
							borderTopWidth: 6,
							borderLeftWidth: 6,
							borderRightWidth: 6,
						}}
						className="white"
					/>
				</div>
			</div>
		</div>
	);
}

export default forwardRef<HTMLSelectElement, Props>(HanabiDropdown);
