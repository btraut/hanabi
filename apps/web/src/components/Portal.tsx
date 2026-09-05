import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface Props {
	readonly rootId?: string;
	readonly children: JSX.Element | JSX.Element[] | null;
}

export default function Portal({ rootId = 'portal', children }: Props): React.ReactPortal {
	const [el] = useState(() => document.createElement('div'));

	useEffect(() => {
		const mount = document.getElementById(rootId);
		if (!mount) throw new Error('Cannot use Portal without a portal root in the DOM.');
		mount.appendChild(el);
		return () => {
			mount.removeChild(el);
		};
	}, [el, rootId]);

	return createPortal(children, el);
}
