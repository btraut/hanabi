import AdminApi, { AdminApiError, AdminGameSummary, AdminGamesPage } from './AdminApi';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type ViewState = 'loading' | 'locked' | 'ready' | 'error';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short',
});

function pageFromSearch(search: string): number {
	const value = Number(new URLSearchParams(search).get('page') ?? '1');
	return Number.isSafeInteger(value) && value > 0 ? value : 1;
}

function resultLabel(game: AdminGameSummary): string {
	if (game.status !== 'finished') return '—';

	switch (game.finishedReason) {
		case 'Won':
			return 'Won';
		case 'OutOfTurns':
			return 'Out of turns';
		case 'OutOfLives':
			return 'Out of lives';
		case 'DiscardedFatalTile':
			return 'Critical discard';
		default:
			return 'Finished';
	}
}

function wordsLabel(value: string): string {
	return value
		.split('_')
		.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
		.join(' ');
}

function startedLabel(startedAt: string | null): string {
	return startedAt ? dateFormatter.format(new Date(startedAt)) : 'Unknown';
}

function GameRow({ game }: { readonly game: AdminGameSummary }): JSX.Element {
	return (
		<article className="admin-game-row">
			<div className="admin-game-main">
				<p className="admin-players">{game.playerNames.join(', ') || 'No named players'}</p>
				<p className="admin-started">{startedLabel(game.startedAt)}</p>
			</div>
			<dl className="admin-game-stats">
				<div>
					<dt>Game</dt>
					<dd>{game.gameCode}</dd>
				</div>
				<div>
					<dt>Status</dt>
					<dd>{wordsLabel(game.status)}</dd>
				</div>
				<div>
					<dt>Turns</dt>
					<dd>{game.moveCount}</dd>
				</div>
				<div>
					<dt>Result</dt>
					<dd>{resultLabel(game)}</dd>
				</div>
				<div>
					<dt>Score</dt>
					<dd>{game.score ?? '—'}</dd>
				</div>
				<div>
					<dt>Integrity</dt>
					<dd>{wordsLabel(game.integrity)}</dd>
				</div>
			</dl>
		</article>
	);
}

export default function AdminPage(): JSX.Element {
	const location = useLocation();
	const navigate = useNavigate();
	const page = pageFromSearch(location.search);
	const [view, setView] = useState<ViewState>('loading');
	const [games, setGames] = useState<AdminGamesPage | null>(null);
	const [password, setPassword] = useState('');
	const [loginError, setLoginError] = useState('');
	const [actionError, setActionError] = useState('');
	const [busy, setBusy] = useState(false);
	const requestId = useRef(0);

	const loadGames = useCallback(async () => {
		const id = ++requestId.current;
		setView('loading');
		try {
			const nextGames = await AdminApi.games(page);
			if (id !== requestId.current) return;
			if (nextGames.items.length === 0 && nextGames.total > 0 && page > 1) {
				const lastPage = Math.ceil(nextGames.total / nextGames.pageSize);
				const populatedPage = lastPage === page ? page - 1 : lastPage;
				void navigate(populatedPage === 1 ? '/admin' : `/admin?page=${populatedPage}`, {
					replace: true,
				});
				return;
			}
			if (nextGames.items.length === 0 && nextGames.total > 0) {
				setGames({ ...nextGames, total: 0 });
				setView('ready');
				return;
			}
			setGames(nextGames);
			setView('ready');
		} catch (error) {
			if (id !== requestId.current) return;
			if (error instanceof AdminApiError && error.status === 401) {
				setGames(null);
				setView('locked');
				return;
			}
			setView('error');
		}
	}, [navigate, page]);

	useEffect(() => {
		void loadGames();
	}, [loadGames]);

	async function submitPassword(event: FormEvent): Promise<void> {
		event.preventDefault();
		setBusy(true);
		setLoginError('');
		try {
			await AdminApi.login(password);
			setPassword('');
			await loadGames();
		} catch (error) {
			setPassword('');
			setLoginError(
				error instanceof AdminApiError && error.status === 401
					? 'That password is not right.'
					: 'The dashboard is unavailable right now.',
			);
		} finally {
			setBusy(false);
		}
	}

	async function logout(): Promise<void> {
		setBusy(true);
		setActionError('');
		try {
			await AdminApi.logout();
			requestId.current += 1;
			setGames(null);
			setView('locked');
		} catch {
			setActionError('Sign out failed. Try again.');
		} finally {
			setBusy(false);
		}
	}

	function goToPage(nextPage: number): void {
		void navigate(nextPage === 1 ? '/admin' : `/admin?page=${nextPage}`);
	}

	if (view === 'locked') {
		return (
			<main className="admin-login-shell">
				<section className="admin-login-card" aria-labelledby="admin-login-title">
					<p className="admin-kicker">Hanabi</p>
					<h1 id="admin-login-title">Game archive</h1>
					<p className="admin-login-copy">Enter the dashboard password to continue.</p>
					<form onSubmit={(event) => void submitPassword(event)}>
						<label htmlFor="admin-password">Password</label>
						<input
							autoComplete="current-password"
							autoFocus
							id="admin-password"
							onChange={(event) => setPassword(event.target.value)}
							required
							type="password"
							value={password}
						/>
						{loginError && <p className="admin-form-error">{loginError}</p>}
						<button disabled={busy} type="submit">
							{busy ? 'Checking…' : 'Open archive'}
						</button>
					</form>
				</section>
			</main>
		);
	}

	if (view === 'loading') {
		return (
			<main className="admin-state-shell">
				<p>Loading game archive…</p>
			</main>
		);
	}

	if (view === 'error' || !games) {
		return (
			<main className="admin-state-shell">
				<h1>Game archive</h1>
				<p>The game archive could not be loaded.</p>
				<button onClick={() => void loadGames()} type="button">
					Try again
				</button>
			</main>
		);
	}

	const firstGame = games.total === 0 ? 0 : (games.page - 1) * games.pageSize + 1;
	const lastGame = Math.min(games.page * games.pageSize, games.total);
	const hasNextPage = lastGame < games.total;

	return (
		<main className="admin-shell">
			<header className="admin-header">
				<div>
					<p className="admin-kicker">Hanabi telemetry</p>
					<h1>Game archive</h1>
					<p>{games.total === 1 ? '1 recorded game' : `${games.total} recorded games`}</p>
					{actionError && (
						<p className="admin-action-error" role="alert">
							{actionError}
						</p>
					)}
				</div>
				<button
					className="admin-quiet-button"
					disabled={busy}
					onClick={() => void logout()}
					type="button"
				>
					Sign out
				</button>
			</header>

			<section className="admin-ledger" aria-label="Recorded games">
				{games.items.length === 0 ? (
					<div className="admin-empty">
						<h2>No games yet</h2>
						<p>Completed and active rounds will appear here once they are recorded.</p>
					</div>
				) : (
					games.items.map((game) => <GameRow game={game} key={game.roundId} />)
				)}
			</section>

			<footer className="admin-pagination">
				<p>{games.total === 0 ? 'No games' : `${firstGame}–${lastGame} of ${games.total}`}</p>
				<div>
					<button disabled={games.page <= 1} onClick={() => goToPage(games.page - 1)} type="button">
						Previous
					</button>
					<button disabled={!hasNextPage} onClick={() => goToPage(games.page + 1)} type="button">
						Next
					</button>
				</div>
			</footer>
		</main>
	);
}
