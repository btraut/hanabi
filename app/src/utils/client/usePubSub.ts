import PubSub from 'app/src/utils/PubSub';
import { useEffect, useRef } from 'react';

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
