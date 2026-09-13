import AdminApi, { AdminApiError, AdminGameSummary, AdminGamesPage } from './AdminApi';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { GameTranscriptV1 } from '@hanabi/shared';
import HanabiReview from '~/games/hanabi/client/HanabiReview';
import HanabiStyles from '~/games/hanabi/client/HanabiStyles';
import { Link, useLocation, useNavigate } from 'react-router-dom';

type ViewState = 'loading' | 'locked' | 'ready' | 'error';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
	dateStyle: 'medium',
	timeStyle: 'short',
});

const RULE_SET_LABELS: Record<AdminGameSummary['initialSettings']['ruleSet'], string> = {
	'5-color': '5-color',
	'6-color': '6-color',
	rainbow: 'Rainbow',
	'black-powder': 'Black Powder',
	'rainbow-black-powder': 'Rainbow + Black Powder',
};

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

function recordedLabel(recordedAt: string): string {
	return dateFormatter.format(new Date(recordedAt));
}

function modeLabel(settings: AdminGameSummary['initialSettings']): string {
	return [
		RULE_SET_LABELS[settings.ruleSet],
		...(settings.criticalGameOver ? ['Critical'] : []),
		...(settings.allowDragging ? ['Dragging'] : []),
		...(settings.showNotes ? ['Notes'] : []),
	].join(' · ');
}

function GameRow({
	game,
	page,
}: {
	readonly game: AdminGameSummary;
	readonly page: number;
}): JSX.Element {
	return (
		<tr>
			<td>
				<time className="admin-recorded" dateTime={game.recordedAt}>
					{recordedLabel(game.recordedAt)}
				</time>
			</td>
			<td className="admin-players">{game.playerNames.join(', ') || 'No named players'}</td>
			<td className="admin-code">{game.gameCode}</td>
			<td className="admin-mode">{modeLabel(game.initialSettings)}</td>
			<td>{wordsLabel(game.status)}</td>
			<td className="admin-number">{game.moveCount}</td>
			<td>{resultLabel(game)}</td>
			<td className="admin-number">{game.score ?? '—'}</td>
			<td>{wordsLabel(game.integrity)}</td>
			<td>
				{game.status === 'finished' && game.integrity === 'complete' ? (
					<Link
						className="admin-review-link"
						to={`/admin?page=${page}&round=${encodeURIComponent(game.roundId)}`}
					>
						Review
					</Link>
				) : (
					'—'
				)}
			</td>
		</tr>
	);
}

export default function AdminPage(): JSX.Element {
	const location = useLocation();
	const navigate = useNavigate();
	const page = pageFromSearch(location.search);
	const roundId = new URLSearchParams(location.search).get('round');
	const [transcript, setTranscript] = useState<GameTranscriptV1 | null>(null);
	const [loadError, setLoadError] = useState('');
	const [view, setView] = useState<ViewState>('loading');
	const [games, setGames] = useState<AdminGamesPage | null>(null);
	const [password, setPassword] = useState('');
	const [loginError, setLoginError] = useState('');
	const [busy, setBusy] = useState(false);
	const requestId = useRef(0);

	const loadArchive = useCallback(async () => {
		const id = ++requestId.current;
		setView('loading');
		setTranscript(null);
		setLoadError('');
		try {
			if (roundId !== null) {
				const nextTranscript = await AdminApi.transcript(roundId);
				if (id !== requestId.current) return;
				setTranscript(nextTranscript);
				setView('ready');
				return;
			}
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
			setLoadError(
				roundId !== null
					? error instanceof AdminApiError && error.status === 404
						? 'This recorded game could not be found.'
						: error instanceof AdminApiError && (error.status === 409 || error.status === 400)
							? 'Review unavailable: this game does not have a complete finished recording.'
							: 'The game review could not be loaded.'
					: 'The game archive could not be loaded.',
			);
			setView('error');
		}
	}, [navigate, page, roundId]);

	useEffect(() => {
		void loadArchive();
		return () => {
			// Invalidate every pending request; this counter is not a DOM ref.
			// eslint-disable-next-line react-hooks/exhaustive-deps
			requestId.current++;
		};
	}, [loadArchive]);

	async function submitPassword(event: FormEvent): Promise<void> {
		event.preventDefault();
		const id = requestId.current;
		setBusy(true);
		setLoginError('');
		try {
			await AdminApi.login(password);
			if (id !== requestId.current) return;
			setPassword('');
			await loadArchive();
		} catch (error) {
			if (id !== requestId.current) return;
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

	function goToPage(nextPage: number): void {
		void navigate(nextPage === 1 ? '/admin' : `/admin?page=${nextPage}`);
	}

	if (view === 'locked') {
		return (
			<main className="admin-login-shell">
				<section className="admin-login-card" aria-labelledby="admin-login-title">
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
				<p>{roundId !== null ? 'Loading game review…' : 'Loading game archive…'}</p>
			</main>
		);
	}

	if (view === 'ready' && transcript) {
		return (
			<>
				<HanabiStyles />
				<HanabiReview
					key={roundId}
					transcript={transcript}
					userId={transcript.turnOrder[0]}
					exitLabel="Back to archive"
					onExit={() => goToPage(page)}
				/>
			</>
		);
	}

	if (view === 'error' || !games) {
		return (
			<main className="admin-state-shell">
				<h1>Game archive</h1>
				<p role="alert">{loadError}</p>
				{roundId !== null && (
					<button onClick={() => goToPage(page)} type="button">
						Back to archive
					</button>
				)}
				<button onClick={() => void loadArchive()} type="button">
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
				<h1>Game archive</h1>
			</header>

			<div className="admin-table-wrap">
				<table className="admin-table">
					<caption>Recorded games</caption>
					<thead>
						<tr>
							<th scope="col">Date</th>
							<th scope="col">Players</th>
							<th scope="col">Game</th>
							<th scope="col">Mode</th>
							<th scope="col">Status</th>
							<th className="admin-number" scope="col">
								Turns
							</th>
							<th scope="col">Result</th>
							<th className="admin-number" scope="col">
								Score
							</th>
							<th scope="col">Integrity</th>
							<th scope="col">Review</th>
						</tr>
					</thead>
					<tbody>
						{games.items.length === 0 ? (
							<tr>
								<td className="admin-empty" colSpan={10}>
									No games yet. Completed and active rounds will appear here once recorded.
								</td>
							</tr>
						) : (
							games.items.map((game) => <GameRow game={game} page={page} key={game.roundId} />)
						)}
					</tbody>
				</table>
			</div>

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
