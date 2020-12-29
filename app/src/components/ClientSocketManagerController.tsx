import { useRef } from 'react';

import ClientSocketManager from '../utils/ClientSocketManager';
import { ClientSocketManagerContextProvider } from './ClientSocketManagerContext';

interface Props {
	readonly children: JSX.Element;
}

export default function ClientSocketManagerController({ children }: Props): JSX.Element {
	const managerRef = useRef<ClientSocketManager>();

	if (!managerRef.current) {
		managerRef.current = new ClientSocketManager();
	}

	return (
		<ClientSocketManagerContextProvider value={managerRef.current}>
			{children}
		</ClientSocketManagerContextProvider>
	);
}
