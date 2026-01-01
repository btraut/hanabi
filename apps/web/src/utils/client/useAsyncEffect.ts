// useAsyncEffect is an extension on React's useEffect that allows for async
// effects functions.
//
// The effect passed to useAsyncEffect will be called with a single prop, a
// isMounted function that can be called to determine if the component is still
// mounted. This allows children to take async actions and then halt should the
// component ever unmount.
//
// useAsyncEffect also allows for a destroy function to be passed. This function
// will be called when the component unmounts in case the caller would like to
// cancel any async actions.
//
// Function signatures:
// void useAsyncEffect(effectFunc, dependenciesArray)
// void useAsyncEffect(effectFunc, destroyFunc, dependenciesArray)

import { DependencyList, useEffect } from 'react';

type EffectFunc<T> = (isMounted: () => boolean) => Promise<T>;
type DestroyFunc<T> = (result: T | undefined) => void;

function _useAsyncEffect<T>(
	effect: EffectFunc<T>,
	destroy: DestroyFunc<T> | null,
	deps: DependencyList = [],
): void {
	useEffect(() => {
		let isMounted = true;
		let result: T | undefined;

		const maybePromise = effect(() => isMounted);
		Promise.resolve(maybePromise).then((value) => {
			result = value;
		});

		return (): void => {
			isMounted = false;

			if (destroy) {
				destroy(result);
			}
		};
	}, deps);
}

export default function useAsyncEffect<T>(
	effect: EffectFunc<T>,
	destroyOrDeps?: DestroyFunc<T> | DependencyList,
	deps?: DependencyList,
): void {
	if (typeof destroyOrDeps === 'function') {
		_useAsyncEffect(effect, destroyOrDeps, deps);
	} else {
		_useAsyncEffect(effect, null, destroyOrDeps);
	}
}
