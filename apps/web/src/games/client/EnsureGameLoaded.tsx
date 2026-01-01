import useAsyncEffect from '~/utils/client/useAsyncEffect';
import { useNavigate } from 'react-router-dom';

interface Props {
	readonly gameLoaded: boolean;
	readonly redirectUrl: string;
	readonly fallback?: JSX.Element | JSX.Element[] | null;
	readonly children: JSX.Element | JSX.Element[] | null;
	readonly loadGameHandler: () => Promise<void>;
}

export default function EnsureGameLoaded({
	gameLoaded,
	children,
	fallback = null,
	redirectUrl,
	loadGameHandler,
}: Props): JSX.Element | null {
	const navigate = useNavigate();

	useAsyncEffect(async () => {
		// No need to load if we already have a game.
		if (gameLoaded) {
			return;
		}

		// Is the user authenticated? If so, we can attempt to load the game.
		// Otherwise, forward the user away.
		try {
			await loadGameHandler();
		} catch (error) {
			navigate(redirectUrl, { replace: true });
		}
	}, [redirectUrl, gameLoaded, navigate, loadGameHandler]);

	if (!gameLoaded) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
