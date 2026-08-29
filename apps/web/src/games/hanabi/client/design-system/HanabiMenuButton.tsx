import classNames from 'classnames';
import { ButtonHTMLAttributes, ForwardedRef, forwardRef } from 'react';

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
	label: string;
	variant?: 'danger' | 'primary' | 'secondary';
	wide?: boolean;
}

function HanabiMenuButton(
	{ className, label, type = 'button', variant = 'secondary', wide = false, ...buttonProps }: Props,
	ref: ForwardedRef<HTMLButtonElement>,
): JSX.Element {
	return (
		<button
			className={classNames(
				'hanabi-button',
				`hanabi-button-${variant}`,
				{ 'hanabi-button-wide': wide },
				className,
			)}
			ref={ref}
			type={type}
			{...buttonProps}
		>
			{label}
		</button>
	);
}

export default forwardRef<HTMLButtonElement, Props>(HanabiMenuButton);
