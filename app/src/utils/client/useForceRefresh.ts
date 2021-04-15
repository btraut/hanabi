import { useCallback, useEffect, useRef, useState } from 'react';

export default function useForceRefresh(): () => void {
	const isMounted = useRef(false);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	const [, setState] = useState<Record<string, never>>({});

	const refresh = useCallback(() => {
		if (!isMounted.current) {
			return;
		}

		setState({});
	}, [isMounted]);

	return refresh;
}
