import GameManager from 'app/src/games/client/GameManager';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import useSocketManager from 'app/src/utils/client/useSocketManager';
import { useHistory, useParams } from 'react-router';

interface Props {
	fallbackUrl: string;
	children: JSX.Element | null;
	gameManager: GameManager;
}

export default function EnsureGameLoaded({
	children,
	gameManager,
	fallbackUrl,
}: Props): JSX.Element | null {
	const socketManager = useSocketManager();
	const history = useHistory();
	const { code = '' } = useParams<{ code?: string }>();

	useAsyncEffect(async () => {
		if (socketManager.authenticated && !gameManager.gameId) {
			try {
				console.log('loading');
				await gameManager.watch(code);
			} catch (error) {
				console.log('load error');
				// history.replace(fallbackUrl);
			}
		}
	}, [gameManager.gameId, code, fallbackUrl, socketManager.authenticated]);

	if (!gameManager.gameId) {
		return null;
	}

	return children;
}
