import classNames from 'classnames';
import { useEffect, useRef, useState } from 'react';

interface Props {
	link: string;
	compact?: boolean;
	label?: string;
}

async function copyText(text: string): Promise<void> {
	if (navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(text);
		return;
	}

	const textArea = document.createElement('textarea');
	textArea.style.width = '1px';
	textArea.style.height = '1px';
	textArea.style.opacity = '0';
	textArea.style.position = 'absolute';
	textArea.value = text;
	document.body.append(textArea);
	textArea.select();
	document.execCommand('copy');
	document.body.removeChild(textArea);
}

export default function HanabiCopyLinkButton({ compact = false, label, link }: Props): JSX.Element {
	const copyButtonRef = useRef<HTMLButtonElement | null>(null);
	const [showCopiedButton, setShowCopiedButton] = useState(false);
	const showCopiedButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const handleLinkClick = async () => {
		try {
			await copyText(link);
		} catch (error: unknown) {
			console.error('Could not copy game link:', error);
			return;
		}
		setShowCopiedButton(true);

		if (showCopiedButtonTimeoutRef.current) clearTimeout(showCopiedButtonTimeoutRef.current);
		showCopiedButtonTimeoutRef.current = setTimeout(() => {
			setShowCopiedButton(false);
			showCopiedButtonTimeoutRef.current = null;
		}, 3000);

		copyButtonRef.current?.focus();
	};

	useEffect(
		() => () => {
			if (showCopiedButtonTimeoutRef.current) clearTimeout(showCopiedButtonTimeoutRef.current);
		},
		[],
	);

	return (
		<div className="grid justify-center">
			<button
				className={classNames(
					'group grid grid-flow-col items-center overflow-hidden font-bold transition-all focus:outline-none',
					{
						'hanabi-focus-ring rounded-md border border-hanabi-border bg-hanabi-surface text-xs':
							compact,
						'max-w-screen-md rounded-lg text-lg': !compact,
					},
				)}
				onClick={() => void handleLinkClick()}
				ref={copyButtonRef}
				type="button"
			>
				<div
					className={classNames('flex self-stretch items-center text-center transition-all', {
						'gap-1.5 px-3 text-hanabi-text-muted group-hover:text-hanabi-text': compact,
						'bg-gray-300 px-5 text-red-600 group-hover:text-red-600 group-focus:bg-white': !compact,
					})}
				>
					{label && <span className="font-medium text-hanabi-text-muted">{label}</span>}
					<span className={classNames({ 'font-mono tracking-[0.14em] text-hanabi-text': compact })}>
						{link}
					</span>
				</div>
				<div
					className={classNames('text-white transition-all', {
						'border-l border-hanabi-border px-2.5 py-2 text-[11px] text-hanabi-coral-soft group-hover:bg-hanabi-coral group-hover:text-white':
							compact,
						'w-28 bg-gray-800 px-5 py-3 group-hover:bg-red-600 group-focus:border-red-600':
							!compact,
					})}
				>
					{showCopiedButton ? 'Copied!' : 'Copy'}
				</div>
			</button>
		</div>
	);
}
