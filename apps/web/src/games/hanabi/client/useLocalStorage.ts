import { useCallback, useState } from 'react';

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (newVal: T) => void] {
	const [localVal, setLocalVal] = useState<T>(() => {
		try {
			const storedValue = localStorage.getItem(key);
			if (storedValue !== null) return JSON.parse(storedValue) as T;
			localStorage.setItem(key, JSON.stringify(defaultValue));
		} catch {
			// Storage may be unavailable or contain an obsolete value. Use the default.
		}
		return defaultValue;
	});

	const storeValue = useCallback(
		(newVal: T) => {
			try {
				localStorage.setItem(key, JSON.stringify(newVal));
			} catch {
				// Keep the in-memory preference usable if storage is unavailable.
			}
			setLocalVal(newVal);
		},
		[key],
	);

	return [localVal, storeValue];
}
