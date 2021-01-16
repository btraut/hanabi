// useValueChanged simply takes a value and returns a truthy value if it has
// changed since the last call. This is good for reacting to props changes.
//
// Example Usage:
//
// const titleChanged = useValueChanged(title);
//
// if (titleChanged) {
//    console.log(`Previous title: ${titleChanged.previous}`)
// }

import * as React from 'react';

export default function useValueChanged<T>(value: T): null | { previous: T } {
	const valueRef = React.useRef(value);
	const valueChanged = value !== valueRef.current;

	const response = valueChanged ? { previous: valueRef.current } : null;

	valueRef.current = value;

	return response;
}
