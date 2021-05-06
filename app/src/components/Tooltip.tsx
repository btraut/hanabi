import classNames from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
	readonly top: number;
	readonly left: number;
	readonly onClose?: () => void;
	readonly children: JSX.Element | JSX.Element[] | null;
	readonly position?: 'above' | 'below';
	readonly fadeIn?: boolean;
}

export default function Tooltip({
	onClose,
	children,
	top,
	left,
	position = 'above',
	fadeIn = false,
}: Props): JSX.Element {
	const tooltipRef = useRef<HTMLDivElement | null>(null);

	const handleBodyClick = useCallback(
		(event: MouseEvent) => {
			let isTooltip = false;
			let ele: any = event.target;
			while (ele) {
				if (ele === tooltipRef.current) {
					isTooltip = true;
					break;
				}
				ele = ele.parentNode;
			}

			if (onClose && !isTooltip) {
				onClose();
			}
		},
		[onClose],
	);
	useEffect(() => {
		document.body.addEventListener('mousedown', handleBodyClick, true);

		return () => {
			document.body.removeEventListener('mousedown', handleBodyClick, true);
		};
	}, [handleBodyClick]);

	const [visible, setVisible] = useState(!fadeIn);
	useEffect(() => {
		setTimeout(() => {
			setVisible(true);
		}, 0);

		return () => {
			setVisible(false);
		};
	}, []);

	return (
		<div
			ref={tooltipRef}
			style={{
				top,
				left,
			}}
			className={classNames('absolute transform transition-all', {
				'-translate-y-full -translate-x-1/2': position === 'above',
				'-translate-x-1/2': position === 'below',
				'opacity-0': !visible,
				'opacity-100': visible,
			})}
		>
			{children}
		</div>
	);
}
