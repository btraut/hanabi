import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
	rootId?: string;
	children: JSX.Element;
}

export default function Portal({ rootId = 'portal', children }: Props): React.ReactPortal {
	const mount = document.getElementById(rootId);
	const el = document.createElement('div');

	if (!mount) {
		throw new Error('Cannot use Portal without a portal root in the DOM.');
	}

	useEffect(() => {
		mount.appendChild(el);
		return () => {
			mount.removeChild(el);
		};
	}, [el, mount]);

	return createPortal(children, el);
}
