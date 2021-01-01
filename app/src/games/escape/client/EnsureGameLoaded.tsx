import { useSocketManager } from 'app/src/components/SocketManagerContext';
import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import { useHistory, useParams } from 'react-router';

interface Props {
	redirectUrl: string;
	fallback?: JSX.Element | null;
	children: JSX.Element | null;
	reloadData: () => Promise<void>;
	gameManager: EscapeGameManager;
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

	console.log('EnsureGameLoaded render', gameManager.gameData, socketManager.authenticated);

	useAsyncEffect(async () => {
		if (socketManager.authenticated && !gameManager.gameData) {
			try {
				await gameManager.watch(code);
				await reloadData();
			} catch (error) {
				history.replace(redirectUrl);
			}
		}
	}, [gameManager.gameData, code, redirectUrl, socketManager.authenticated, reloadData]);

	if (!gameManager.gameData) {
		return fallback;
	}

	return children;
}
