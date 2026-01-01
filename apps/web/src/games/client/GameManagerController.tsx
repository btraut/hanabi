import { useSocket } from '~/components/SocketContext';
import GameManager from '~/games/client/GameManager';
import { GameManagerContextProvider } from '~/games/client/GameManagerContext';
import { GameManagerMessage } from '@hanabi/shared';
import { useRef } from 'react';

interface Props {
	readonly children: JSX.Element | JSX.Element[] | null;
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
