import { ChangeEventHandler, ForwardedRef, forwardRef, useId } from 'react';

interface Props {
	id?: string;
	options: { [label: string]: string };
	onChange: ChangeEventHandler<HTMLSelectElement>;
	value: string;
}

function HanabiDropdown(
	{ id, onChange, options, value }: Props,
	ref: ForwardedRef<HTMLSelectElement>,
): JSX.Element {
	const generatedId = useId();
	const finalId = id ?? `dropdown-${generatedId}`;

	return (
		<div className="grid justify-start">
			<div className="hanabi-select-wrap">
				<select
					className="hanabi-field hanabi-select"
					id={finalId}
					onChange={onChange}
					ref={ref}
					value={value}
				>
					{Object.keys(options).map((label) => (
						<option key={options[label]} value={options[label]}>
							{label}
						</option>
					))}
				</select>
				<span aria-hidden="true" className="hanabi-select-chevron" />
			</div>
		</div>
	);
}

export default forwardRef<HTMLSelectElement, Props>(HanabiDropdown);
