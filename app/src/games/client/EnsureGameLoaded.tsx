import { useSocketManager } from 'app/src/components/SocketManagerContext';
import GameManager from 'app/src/games/client/GameManager';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import { useHistory, useParams } from 'react-router';

interface Props {
	redirectUrl: string;
	fallback?: JSX.Element | null;
	children: JSX.Element | null;
	reloadData: () => Promise<void>;
	gameManager: GameManager;
}

export default function EnsureGameLoaded({
	children,
	gameManager,
	fallback = null,
	redirectUrl,
	reloadData,
}: Props): JSX.Element | null {
	const socketManager = useSocketManager();
	const history = useHistory();
	const { code = '' } = useParams<{ code?: string }>();

	console.log('EnsureGameLoaded render', socketManager.authenticated);

	useAsyncEffect(async () => {
		if (socketManager.authenticated && !gameManager.gameId) {
			try {
				await gameManager.watch(code);
				await reloadData();
			} catch (error) {
				history.replace(redirectUrl);
			}
		}
	}, [gameManager.gameId, code, redirectUrl, socketManager.authenticated, reloadData]);

	if (!gameManager.gameId) {
		return fallback;
	}

	return children;
}
