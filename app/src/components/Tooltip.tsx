import classnames from 'classnames';
import { useCallback, useEffect, useRef } from 'react';

interface Props {
	top: number;
	left: number;
	onClose: () => void;
	children: JSX.Element;
}

export default function Tooltip({ onClose, children, top, left }: Props): JSX.Element {
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

	return (
		<div
			ref={tooltipRef}
			className={classnames('absolute', {
				top,
				left,
			})}
		>
			{children}
		</div>
	);
}
