import Portal from 'app/src/components/Portal';
import HanabiXButton from 'app/src/games/hanabi/client/design-system/HanabiXButton';
import classnames from 'classnames';
import { useEffect, useRef } from 'react';
import FocusLock from 'react-focus-lock';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | string;
	readonly background?: 'red' | 'green' | 'gray';
	readonly onClose?: () => void;
	readonly closeButton?: boolean;
	readonly backgroundWash?: boolean;
}

const BACKGROUND_CLASS = {
	red: 'bg-red-900',
	green: 'bg-green-900',
	gray: 'bg-gray-800',
};

export default function HanabiPopup({
	children,
	background = 'gray',
	closeButton = false,
	backgroundWash = false,
	onClose,
}: Props): JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.focus();
		}
	}, []);

	return (
		<Portal>
			<FocusLock>
				<div
					className="absolute inset-0 w-full flex items-center justify-center"
					style={{ backgroundColor: backgroundWash ? 'rgba(0, 0, 0, 0.4)' : '' }}
					ref={containerRef}
				>
					<div
						className={classnames(
							'border-solid border-black border-2 px-8 py-6 shadow-dark relative',
							BACKGROUND_CLASS[background],
						)}
					>
						{closeButton && onClose && (
							<div className="absolute right-0 top-0 m-2">
								<HanabiXButton onClick={onClose} />
							</div>
						)}
						{children}
					</div>
				</div>
			</FocusLock>
		</Portal>
	);
}
