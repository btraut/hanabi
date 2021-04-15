import { useCallback, useEffect, useRef, useState } from 'react';
import store from 'store';

export function useLocalStorage<T = any>(key: string, defaultValue: T): [T, (newVal: T) => void] {
	const fetchedFromStorageRef = useRef(false);

	let initialStorageVal: T | null = null;
	if (!fetchedFromStorageRef.current) {
		initialStorageVal = store.get(key);
		fetchedFromStorageRef.current = true;
	}

	useEffect(() => {
		if (initialStorageVal === null && defaultValue !== null) {
			store.set(key, defaultValue);
		}

		// defaultValue is intended to be unmanaged, so we're only going to run
		// this on mount.
		//
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const [localVal, setLocalVal] = useState(initialStorageVal ?? defaultValue);

	const storeValue = useCallback(
		(newVal: T) => {
			store.set(key, newVal);
			setLocalVal(newVal);
		},
		[key],
	);

	return [localVal, storeValue];
}
