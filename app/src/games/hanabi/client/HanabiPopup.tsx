import classnames from 'classnames';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | string;
	readonly background?: 'red' | 'green' | 'gray';
}

const BACKGROUND_CLASS = {
	red: 'bg-red-900',
	green: 'bg-green-900',
	gray: 'bg-gray-800',
};

export default function HanabiPopup({ children, background = 'gray' }: Props): JSX.Element {
	return (
		<div className="absolute mt-24 w-full flex justify-center">
			<div
				className={classnames(
					'border-solid border-black border-2 px-8 py-6 shadow-dark',
					BACKGROUND_CLASS[background],
				)}
			>
				{children}
			</div>
		</div>
	);
}
