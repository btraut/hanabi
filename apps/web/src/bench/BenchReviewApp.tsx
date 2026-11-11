import type { BenchReviewSnapshot } from '@hanabi/shared';
import { useEffect, useState, type ReactNode } from 'react';
import HanabiReview from '../games/hanabi/client/HanabiReview';
import './BenchReviewApp.css';

type ReviewGame = NonNullable<BenchReviewSnapshot['game']>;

interface ReviewState {
	target: string;
	snapshot?: BenchReviewSnapshot;
	error?: string;
}

function useReview(token: string, gameId: string): ReviewState {
	const [state, setState] = useState<ReviewState>({ target: gameId });
	useEffect(() => {
		if (!token) return;
		const controller = new AbortController();
		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;
		async function poll() {
			try {
				const response = await fetch(
					`/api/review${gameId ? `?game=${encodeURIComponent(gameId)}` : ''}`,
					{
						headers: { Authorization: `Bearer ${token}` },
						signal: controller.signal,
						cache: 'no-store',
					},
				);
				if (!response.ok)
					throw new Error(
						response.status === 401 || response.status === 403
							? 'Review access expired. Reopen the URL printed by the bench command.'
							: `Cannot load review (${response.status}). Retrying…`,
					);
				const snapshot = (await response.json()) as BenchReviewSnapshot;
				if (!stopped) setState({ target: gameId, snapshot });
			} catch (error) {
				if (!stopped)
					setState((previous) => ({
						target: gameId,
						snapshot: previous.target === gameId ? previous.snapshot : undefined,
						error:
							error instanceof Error ? error.message : 'Cannot reach the review server. Retrying…',
					}));
			} finally {
				if (!stopped)
					timer = setTimeout(() => {
						void poll();
					}, 1000);
			}
		}
		void poll();
		return () => {
			stopped = true;
			controller.abort();
			clearTimeout(timer);
		};
	}, [token, gameId]);
	if (!token)
		return {
			target: gameId,
			error: 'Open the local review URL printed by the bench command. Its access token is missing.',
		};
	return state.target === gameId ? state : { ...state, error: undefined };
}

function Reasoning({ game, cursor }: { game: ReviewGame; cursor: number }) {
	const move = game.transcript.moves[cursor - 1];
	const name = (playerId: string) =>
		game.transcript.players.find((player) => player.id === playerId)?.name ?? playerId;
	const decision =
		move &&
		game.logs.find(
			(log) =>
				log.opportunity === 'turn' && log.turn === cursor - 1 && log.playerId === move.actorId,
		);
	const reflection =
		move &&
		game.logs.find(
			(log) => log.opportunity === 'result' && log.turn === cursor && log.playerId === move.actorId,
		);
	const total = game.transcript.moves.length;
	const nextActor =
		game.transcript.moves.at(-1)?.postTurn.nextPlayerId ?? game.transcript.turnOrder[0];
	const pending =
		cursor === total && game.transcript.lifecycle.status === 'in_progress'
			? game.logs.find(
					(log) => log.opportunity === 'turn' && log.turn === total && log.playerId === nextActor,
				)
			: undefined;
	return (
		<section className="bench-reasoning" aria-label="Agent reasoning">
			<h2>{move ? `Turn ${cursor} · ${name(move.actorId)}` : 'Initial deal'}</h2>
			{move ? (
				<>
					<h3>Decision</h3>
					<p>{decision?.text ?? 'No decision log recorded for this move.'}</p>
					<h3>After the move</h3>
					<p>{reflection?.text ?? 'No reflection recorded yet.'}</p>
				</>
			) : (
				<p>Select a move to read its decision and reflection.</p>
			)}
			{pending && (
				<section className="bench-pending" aria-label="Pending decision">
					<h3>
						Pending turn {total + 1} · {name(pending.playerId)}
					</h3>
					<p>{pending.text}</p>
					<p className="bench-muted">This decision has not been accepted as a move.</p>
				</section>
			)}
		</section>
	);
}

function GameReview({ game, header }: { game: ReviewGame; header: ReactNode }) {
	const [follow, setFollow] = useState(true);
	const [position, setPosition] = useState(0);
	const cursor = follow
		? game.transcript.moves.length
		: Math.min(position, game.transcript.moves.length);
	return (
		<HanabiReview
			transcript={game.transcript}
			userId={game.transcript.turnOrder[0]}
			onExit={() => {}}
			allowInProgress
			cursor={cursor}
			onCursorChange={(next) => {
				setPosition(next);
				setFollow(false);
			}}
			headerContent={
				<>
					{header}
					<label className="bench-follow">
						<input
							type="checkbox"
							checked={follow}
							onChange={(event) => {
								setPosition(cursor);
								setFollow(event.target.checked);
							}}
						/>
						Follow latest moves
					</label>
				</>
			}
			activityDetails={
				<>
					<Reasoning game={game} cursor={cursor} />
					<details className="bench-document">
						<summary>Shared conventions</summary>
						<p>{game.conventions || 'No conventions supplied.'}</p>
					</details>
					{game.dreamer && (
						<details className="bench-document">
							<summary>
								Dreamer · {game.dreamer.changed ? 'Revised conventions' : 'No change'}
							</summary>
							<p>{game.dreamer.explanation}</p>
							{game.dreamer.conventions && (
								<>
									<h3>Next conventions</h3>
									<p>{game.dreamer.conventions}</p>
								</>
							)}
						</details>
					)}
				</>
			}
		/>
	);
}

export default function BenchReviewApp({
	token = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '',
}: {
	token?: string;
}): JSX.Element {
	const [selected, setSelected] = useState('');
	const { snapshot, error, target } = useReview(token, selected);
	const game = target === selected ? snapshot?.game : null;
	const status =
		game?.status === 'playing'
			? 'Live'
			: game?.status === 'completed'
				? 'Completed'
				: game?.status === 'failed'
					? 'Failed'
					: 'Waiting';
	const header = (
		<>
			<h1>Hanabi Bench</h1>
			<label className="bench-game-select">
				Game{' '}
				<select value={selected} onChange={(event) => setSelected(event.target.value)}>
					<option value="">Latest game</option>
					{snapshot?.games.map((item) => (
						<option key={item.id} value={item.id}>
							{item.label} · {item.status}
						</option>
					))}
				</select>
			</label>
			<span className={`bench-status bench-status-${game?.status ?? 'waiting'}`} role="status">
				{status}
			</span>
		</>
	);
	return (
		<div className="bench-review hanabi-game-surface">
			{error && (
				<p className="bench-banner" role="alert">
					{error}
				</p>
			)}
			{game?.error && (
				<p className="bench-banner" role="alert">
					Game failed: {game.error}
				</p>
			)}
			{game ? (
				<GameReview key={game.id} game={game} header={header} />
			) : (
				<div className="hanabi-review">
					<header className="hanabi-review-header">{header}</header>
					<p className="bench-empty">
						{error
							? 'Review is unavailable until the connection is restored.'
							: target !== selected
								? 'Loading selected game…'
								: snapshot
									? 'Waiting for the first game transcript…'
									: 'Connecting to local review…'}
					</p>
				</div>
			)}
			{snapshot && <footer className="bench-source">Local review · {snapshot.source}</footer>}
		</div>
	);
}
