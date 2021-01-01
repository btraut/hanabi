import { useEffect, useRef } from 'react';

import SocketManager from '../utils/client/SocketManager';
import { SocketManagerContextProvider } from './SocketManagerContext';

interface Props {
	readonly children: JSX.Element;
}

export default function SocketManagerController({ children }: Props): JSX.Element {
	const managerRef = useRef<SocketManager>();

	if (!managerRef.current) {
		managerRef.current = new SocketManager();
	}

	useEffect(() => {
		if (managerRef.current) {
			managerRef.current.connect();
		}

		return () => {
			if (managerRef.current) {
				managerRef.current.disconnect();
			}
		};
	}, []);

	return (
		<SocketManagerContextProvider value={managerRef.current}>
			{children}
		</SocketManagerContextProvider>
	);
}
