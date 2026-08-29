import Portal from '~/components/Portal';
import HanabiXButton from '~/games/hanabi/client/design-system/HanabiXButton';
import { PointerEvent, ReactNode, useEffect, useId } from 'react';
import FocusLock from 'react-focus-lock';

interface Props {
	children: ReactNode;
	onClose: () => void;
	title: string;
	tone?: 'danger' | 'neutral' | 'success';
}

export default function HanabiDialog({
	children,
	onClose,
	title,
	tone = 'neutral',
}: Props): JSX.Element {
	const titleId = useId();

	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		const handleKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') onClose();
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [onClose]);

	const handleBackdropPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
		if (event.target === event.currentTarget) onClose();
	};

	return (
		<Portal>
			<FocusLock returnFocus>
				<div className="hanabi-dialog-backdrop" onPointerDown={handleBackdropPointerDown}>
					<section
						aria-labelledby={titleId}
						aria-modal="true"
						className="hanabi-dialog"
						data-tone={tone}
						role="dialog"
					>
						<header className="hanabi-dialog-header">
							<h1 className="hanabi-dialog-title" id={titleId}>
								{title}
							</h1>
							<HanabiXButton autoFocus onClick={onClose} />
						</header>
						<div className="hanabi-dialog-body">{children}</div>
					</section>
				</div>
			</FocusLock>
		</Portal>
	);
}
