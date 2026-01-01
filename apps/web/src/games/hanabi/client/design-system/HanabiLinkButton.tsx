import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { forwardRef } from 'react';

interface Props {
	href: string;
	label: string;
}

function HanabiLinkButton({ href, label }: Props, ref: any): JSX.Element {
	const isFocusVisible = useFocusVisible();

	return (
		<a
			className={classNames(
				'block px-5 py-3 bg-gray-800 text-center uppercase font-bold rounded-xl border-4 duration-100 focus:outline-none',
				'border-white cursor-pointer text-white hover:bg-red-600 active:scale-95 select-none',
				{
					'focus:border-red-600': isFocusVisible,
				},
			)}
			href={href}
			ref={ref}
		>
			{label}
		</a>
	);
}

export default forwardRef<HTMLAnchorElement, Props>(HanabiLinkButton);
