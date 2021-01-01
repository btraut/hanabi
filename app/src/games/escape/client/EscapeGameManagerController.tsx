import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { EscapeGameManagerContextProvider } from 'app/src/games/escape/client/EscapeGameManagerContext';
import useSocketManager from 'app/src/utils/client/useSocketManager';
import { useRef } from 'react';

interface Props {
	readonly children: JSX.Element;
}

export default function EscapeGameManagerController({ children }: Props): JSX.Element {
	const managerRef = useRef<EscapeGameManager>();
	const socketManager = useSocketManager();

	if (!managerRef.current) {
		managerRef.current = new EscapeGameManager(socketManager);
	}

	return (
		<EscapeGameManagerContextProvider value={managerRef.current}>
			{children}
		</EscapeGameManagerContextProvider>
	);
}
