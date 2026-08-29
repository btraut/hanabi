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

	if (compact) {
		return (
			<button
				aria-label={`Copy game code ${link}`}
				className="hanabi-focus-ring group flex items-center gap-3 rounded-md text-sm focus:outline-none"
				onClick={() => void handleLinkClick()}
				ref={copyButtonRef}
				type="button"
			>
				{label && <span className="hanabi-game-code-label text-hanabi-coral-soft">{label}</span>}
				<span className="font-mono text-lg font-medium tracking-[0.08em] text-hanabi-text">
					{link}
				</span>
				<span aria-hidden="true" className="relative block h-6 w-5 text-hanabi-text">
					<span className="absolute left-0 top-0 size-4 rounded-sm border border-current" />
					<span className="absolute bottom-0 right-0 size-4 rounded-sm border border-current bg-hanabi-table-deep" />
				</span>
				<span aria-live="polite" className="sr-only">
					{showCopiedButton ? 'Copied!' : ''}
				</span>
			</button>
		);
	}

	return (
		<div className="grid justify-center">
			<button
				aria-label={`Copy game link ${link}`}
				className="hanabi-copy-control hanabi-focus-ring group"
				onClick={() => void handleLinkClick()}
				ref={copyButtonRef}
				type="button"
			>
				<span className="hanabi-copy-control-value">
					{label && <span className="font-medium text-hanabi-text-muted">{label}</span>}
					<span className="font-mono tracking-[0.08em] text-hanabi-text">{link}</span>
				</span>
				<span className="hanabi-copy-control-action" aria-live="polite">
					{showCopiedButton ? 'Copied!' : 'Copy'}
				</span>
			</button>
		</div>
	);
}
