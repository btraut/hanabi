import { useCallback, useState } from 'react';

export default function useForceRefresh(): () => void {
	const [, setState] = useState<Record<string, never>>({});

	const refresh = useCallback(() => {
		setState({});
	}, []);

	return refresh;
}
