import { useSocketManager } from 'app/src/components/SocketManagerContext';
import { useEscapeGameContext } from 'app/src/games/escape/client/EscapeGameContext';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import { useHistory, useParams } from 'react-router';

interface Props {
	redirectUrl: string;
	fallback?: JSX.Element | null;
	children: JSX.Element | null;
}

export default function EnsureGameLoaded({
	children,
	fallback = null,
	redirectUrl,
}: Props): JSX.Element | null {
	const socketManager = useSocketManager();
	const escapeGameContext = useEscapeGameContext();

	const history = useHistory();
	const { code = '' } = useParams<{ code?: string }>();

	useAsyncEffect(async () => {
		if (socketManager.authenticated && !escapeGameContext.game?.gameData) {
			try {
				await escapeGameContext.watch(code);
			} catch (error) {
				history.replace(redirectUrl);
			}
		}
	}, [code, redirectUrl, socketManager.authenticated]);

	if (!escapeGameContext.game?.gameData) {
		return fallback;
	}

	return children;
}
