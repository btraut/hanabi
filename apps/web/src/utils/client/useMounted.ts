import { useCallback, useEffect, useRef } from 'react';

export default function useIsMounted(): () => boolean {
	const isMounted = useRef(false);

	useEffect(() => {
		isMounted.current = true;
		return () => {
			isMounted.current = false;
		};
	}, []);

	const checker = useCallback((): boolean => {
		return isMounted.current;
	}, []);

	return checker;
}
