import { ChangeEventHandler, ForwardedRef, forwardRef, useId } from 'react';

interface Props {
	id?: string;
	onChange: ChangeEventHandler<HTMLInputElement>;
	checked: boolean;
}

function HanabiCheckbox(
	{ id, onChange, checked }: Props,
	ref: ForwardedRef<HTMLInputElement>,
): JSX.Element {
	const generatedId = useId();
	const finalId = id ?? `checkbox-${generatedId}`;

	return (
		<span className="hanabi-checkbox-wrap">
			<input
				checked={checked}
				className="hanabi-checkbox"
				id={finalId}
				onChange={onChange}
				ref={ref}
				type="checkbox"
			/>
			{checked && <span aria-hidden="true" className="hanabi-checkbox-check" />}
		</span>
	);
}

export default forwardRef<HTMLInputElement, Props>(HanabiCheckbox);
