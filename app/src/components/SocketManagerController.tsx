import { SocketMessageBase } from 'app/src/models/SocketMessage';
import { useEffect, useRef } from 'react';

import SocketManager from '../utils/client/SocketManager';
import { SocketManagerContextProvider } from './SocketManagerContext';

interface Props {
	readonly children: JSX.Element;
}

export default function SocketManagerController<MessageType extends SocketMessageBase>({
	children,
}: Props): JSX.Element {
	const managerRef = useRef<SocketManager<MessageType>>();

	if (!managerRef.current) {
		managerRef.current = new SocketManager<MessageType>();
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
