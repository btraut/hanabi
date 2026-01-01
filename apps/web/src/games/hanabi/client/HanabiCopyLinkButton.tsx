import classNames from 'classnames';
import { useRef, useState } from 'react';

interface Props {
	link: string;
}

export default function HanabiCopyLinkButton({ link }: Props): JSX.Element {
	const copyButtonRef = useRef<HTMLButtonElement | null>(null);
	const [showCopiedButton, setShowCopiedButton] = useState(false);
	const showCopiedButtonTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const handleLinkClick = () => {
		const textArea = document.createElement('textarea');
		textArea.style.width = '1px';
		textArea.style.height = '1px';
		textArea.style.opacity = '0';
		textArea.style.position = 'absolute';
		textArea.value = link;
		document.body.append(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);

		setShowCopiedButton(true);

		if (!showCopiedButtonTimeoutRef.current) {
			showCopiedButtonTimeoutRef.current = setTimeout(() => {
				setShowCopiedButton(false);
			}, 3000);
			showCopiedButtonTimeoutRef.current = null;
		}

		copyButtonRef.current?.focus();
	};

	return (
		<div className="grid justify-center">
			<button
				className={classNames(
					'outline-none grid grid-flow-col items-center max-w-screen-md overflow-hidden rounded-lg font-bold text-lg',
					'group transition-all focus:outline-none',
				)}
				onClick={handleLinkClick}
				ref={copyButtonRef}
			>
				<div className="self-stretch items-center flex px-5 text-center text-red-600 group-hover:text-red-600 transition-all bg-gray-300 group-focus:bg-white">
					{link}
				</div>
				<div className="text-white bg-gray-800 px-5 py-3 w-28 group-hover:bg-red-600 transition-all group-focus:border-red-600">
					{showCopiedButton ? 'Copied!' : 'Copy'}
				</div>
			</button>
		</div>
	);
}
