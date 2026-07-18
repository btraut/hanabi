import { loadGameUntilSuccessful } from './loadGameUntilSuccessful';
import { GameWatchRejectedError } from './GameManager';
import { useEffect } from 'react';
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

	useEffect(() => {
		let active = true;
		if (!gameLoaded) {
			void (async () => {
				// Keep the game URL intact while connection/authentication recovers.
				try {
					await loadGameUntilSuccessful(
						loadGameHandler,
						() => active,
						undefined,
						(error) => !(error instanceof GameWatchRejectedError),
					);
				} catch (error) {
					if (error instanceof GameWatchRejectedError && active) {
						await navigate(redirectUrl, { replace: true });
					}
				}
			})().catch((error: unknown) => {
				console.error('Could not finish loading the game:', error);
			});
		}

		return () => {
			active = false;
		};
	}, [redirectUrl, gameLoaded, navigate, loadGameHandler]);

	if (!gameLoaded) {
		return <>{fallback}</>;
	}

	return <>{children}</>;
}
