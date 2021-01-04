import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import { useHistory } from 'react-router';

interface Props<GameType> {
	game: GameType | null | undefined;
	redirectUrl: string;
	fallback?: JSX.Element | null;
	children: JSX.Element | null;
	loadGameHandler: () => Promise<void>;
}

export default function EnsureGameLoaded<GameType>({
	game,
	children,
	fallback = null,
	redirectUrl,
	loadGameHandler,
}: Props<GameType>): JSX.Element | null {
	const history = useHistory();

	useAsyncEffect(async () => {
		// No need to load if we already have a game.
		if (game) {
			return;
		}

		// Is the user authenticated? If so, we can attempt to load the game.
		// Otherwise, forward the user away.
		try {
			await loadGameHandler();
		} catch (error) {
			history.replace(redirectUrl);
		}
	}, [redirectUrl, game, history, loadGameHandler]);

	if (!game) {
		return fallback;
	}

	return children;
}
