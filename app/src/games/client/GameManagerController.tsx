import { useSocket } from 'app/src/components/SocketContext';
import GameManager from 'app/src/games/client/GameManager';
import { GameManagerContextProvider } from 'app/src/games/client/GameManagerContext';
import { GameManagerMessage } from 'app/src/games/GameManagerMessages';
import { useRef } from 'react';

interface Props {
	readonly children: JSX.Element;
}

export default function GameManagerController({ children }: Props): JSX.Element {
	const gameManagerRef = useRef<GameManager>();
	const { socketManager } = useSocket<GameManagerMessage>();

	if (!gameManagerRef.current) {
		gameManagerRef.current = new GameManager(socketManager);
	}

	return (
		<GameManagerContextProvider value={gameManagerRef.current}>
			{children}
		</GameManagerContextProvider>
	);
}
