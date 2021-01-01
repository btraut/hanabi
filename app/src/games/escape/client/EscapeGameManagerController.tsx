import { useSocketManager } from 'app/src/components/SocketManagerContext';
import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import { EscapeGameManagerContextProvider } from 'app/src/games/escape/client/EscapeGameManagerContext';
import { useEffect, useRef } from 'react';

interface Props {
	readonly children: JSX.Element;
}

export default function EscapeGameManagerController({ children }: Props): JSX.Element {
	const gameManagerRef = useRef<EscapeGameManager>();
	const socketManager = useSocketManager(false);

	if (!gameManagerRef.current) {
		gameManagerRef.current = new EscapeGameManager(socketManager);
	}

	useEffect(
		() => () => {
			if (gameManagerRef.current) {
				gameManagerRef.current.cleanUp();
				gameManagerRef.current = undefined;
			}
		},
		[],
	);

	return (
		<EscapeGameManagerContextProvider value={gameManagerRef.current}>
			{children}
		</EscapeGameManagerContextProvider>
	);
}
