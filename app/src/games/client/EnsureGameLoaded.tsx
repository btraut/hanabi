import GameManager from 'app/src/games/client/GameManager';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import useSocketManager from 'app/src/utils/client/useSocketManager';
import { useHistory, useParams } from 'react-router';

interface Props {
	fallbackUrl: string;
	children: JSX.Element | null;
	reloadData: () => Promise<void>;
	gameManager: GameManager;
}

export default function EnsureGameLoaded({
	children,
	gameManager,
	fallbackUrl,
	reloadData,
}: Props): JSX.Element | null {
	const socketManager = useSocketManager();
	const history = useHistory();
	const { code = '' } = useParams<{ code?: string }>();

	useAsyncEffect(async () => {
		if (socketManager.authenticated && !gameManager.gameId) {
			try {
				await gameManager.watch(code);
				await reloadData();
			} catch (error) {
				history.replace(fallbackUrl);
			}
		}
	}, [gameManager.gameId, code, fallbackUrl, socketManager.authenticated, reloadData]);

	if (!gameManager.gameId) {
		return null;
	}

	return children;
}
