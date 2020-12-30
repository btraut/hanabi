import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import SocketManager from 'app/src/utils/client/SocketManager';
import useForceRefresh from 'app/src/utils/client/useForceRefresh';
import usePubSub from 'app/src/utils/client/usePubSub';
import { useRef } from 'react';

export default function useEscapeGameManager(socketManager: SocketManager): EscapeGameManager {
	const gameManagerRef = useRef<EscapeGameManager | null>(null);

	if (!gameManagerRef.current) {
		gameManagerRef.current = new EscapeGameManager(socketManager);
	}

	const forceRefresh = useForceRefresh();
	usePubSub(gameManagerRef.current.onUpdate, forceRefresh);

	return gameManagerRef.current;
}
