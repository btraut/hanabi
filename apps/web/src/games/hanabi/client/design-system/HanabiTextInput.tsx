import classNames from 'classnames';
import { ForwardedRef, forwardRef, InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

function HanabiTextInput(
	{ className, ...inputProps }: Props,
	ref: ForwardedRef<HTMLInputElement>,
): JSX.Element {
	return (
		<input
			autoCapitalize="none"
			autoCorrect="off"
			className={classNames('hanabi-field px-3.5 py-2', className)}
			ref={ref}
			type="text"
			{...inputProps}
		/>
	);
}

export default forwardRef<HTMLInputElement, Props>(HanabiTextInput);
