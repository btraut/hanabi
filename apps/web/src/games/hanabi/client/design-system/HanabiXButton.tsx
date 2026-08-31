import X from '~/games/hanabi/client/icons/X';
import { ForwardedRef, forwardRef } from 'react';

interface Props {
	autoFocus?: boolean;
	onClick: () => void;
}

function HanabiXButton(
	{ autoFocus = false, onClick }: Props,
	ref: ForwardedRef<HTMLButtonElement>,
): JSX.Element {
	return (
		<button
			aria-label="Close dialog"
			autoFocus={autoFocus}
			className="hanabi-icon-button"
			onClick={onClick}
			ref={ref}
			type="button"
		>
			<X color="currentColor" size={18} />
		</button>
	);
}

export default forwardRef<HTMLButtonElement, Props>(HanabiXButton);
