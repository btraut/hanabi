import { useEffect } from 'react';

export default function useSetTitle(title: string): void {
	useEffect(() => {
		if (typeof document !== 'undefined') {
			document.title = title;
		}
	}, [title]);
}
