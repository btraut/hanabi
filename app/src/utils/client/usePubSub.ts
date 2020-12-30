import { useEffect, useRef } from 'react';

import PubSub from '../PubSub';

export default function usePubSub<T>(pubSub: PubSub<T>, handler: (arg: T) => void): void {
	const subscriptionIdRef = useRef<number | null>(null);

	useEffect(() => {
		if (subscriptionIdRef.current === null) {
			subscriptionIdRef.current = pubSub.subscribe(handler);
		}

		return () => {
			if (subscriptionIdRef.current) {
				pubSub.unsubscribe(subscriptionIdRef.current);
				subscriptionIdRef.current = null;
			}
		};
	}, [pubSub, handler]);
}
