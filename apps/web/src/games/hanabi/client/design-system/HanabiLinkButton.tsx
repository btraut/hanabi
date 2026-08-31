import classNames from 'classnames';
import { AnchorHTMLAttributes, ForwardedRef, forwardRef } from 'react';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> {
	href: string;
	label: string;
	variant?: 'danger' | 'primary' | 'secondary';
	wide?: boolean;
}

function HanabiLinkButton(
	{ className, href, label, variant = 'secondary', wide = false, ...anchorProps }: Props,
	ref: ForwardedRef<HTMLAnchorElement>,
): JSX.Element {
	return (
		<a
			className={classNames(
				'hanabi-button',
				`hanabi-button-${variant}`,
				{ 'hanabi-button-wide': wide },
				className,
			)}
			href={href}
			ref={ref}
			{...anchorProps}
		>
			{label}
		</a>
	);
}

export default forwardRef<HTMLAnchorElement, Props>(HanabiLinkButton);
