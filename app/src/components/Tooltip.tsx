import classnames from 'classnames';
import { useCallback, useEffect, useRef } from 'react';

interface Props {
	readonly top: number;
	readonly left: number;
	readonly onClose?: () => void;
	readonly children: JSX.Element | JSX.Element[] | null;
	readonly position?: 'above' | 'below';
}

export default function Tooltip({
	onClose,
	children,
	top,
	left,
	position = 'above',
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

	return (
		<div
			ref={tooltipRef}
			style={{
				top,
				left,
			}}
			className={classnames('absolute transform', {
				'-translate-y-full -translate-x-1/2': position === 'above',
				'-translate-x-1/2': position === 'below',
			})}
		>
			{children}
		</div>
	);
}
