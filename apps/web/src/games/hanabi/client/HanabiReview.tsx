import {
	HanabiReviewStep,
	getHanabiReviewSteps,
	GameTranscriptV1,
	getHanabiMaxScore,
	getHanabiScore,
	HanabiStage,
	isReplayableTranscript,
	projectHanabiReplay,
	replayHanabiReview,
} from '@hanabi/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import HanabiDesktopBoard from './HanabiDesktopBoard';
import HanabiDesktopTableau from './HanabiDesktopTableau';
import HanabiDesktopStatus from './HanabiDesktopStatus';
import HanabiPlayerWorkspace from './HanabiPlayerWorkspace';
import HanabiTileView from './HanabiTileView';
import {
	HANABI_DESKTOP_TILE_SIZE,
	HANABI_DESKTOP_SURFACE_HEIGHT,
	HANABI_DESKTOP_ZONE_HEIGHT,
	getHanabiDesktopTileStyle,
} from './HanabiDesktopTileGeometry';
import { getHanabiTileNotesDescription } from './HanabiTileNotesTooltip';
import './HanabiReview.css';

interface Props {
	transcript: GameTranscriptV1;
	userId: string;
	onExit: () => void;
	exitLabel?: string;
}

export function getReviewMoveLabel(move: HanabiReviewStep, transcript: GameTranscriptV1): string {
	const name = (id: string) =>
		transcript.players.find((player) => player.id === id)?.name ?? 'Player';
	if (move.type === 'reposition') return `${name(move.actorId)} rearranged their hand`;
	if (move.type === 'clue') {
		return `${name(move.actorId)} gave ${name(move.recipientId)} a ${move.clue.value} clue`;
	}
	const tile = transcript.deck?.find((item) => item.id === move.tileId);
	const card = tile ? `${tile.color} ${tile.number}` : 'a card';
	return `${name(move.actorId)} ${move.type === 'discard' ? 'discarded' : 'played'} ${card}${move.type === 'play' && !move.valid ? ' · failed' : ''}`;
}

export default function HanabiReview({
	transcript,
	userId,
	onExit,
	exitLabel = 'Back to game',
}: Props): JSX.Element {
	const [cursor, setCursor] = useState(0);
	const [perspective, setPerspective] = useState<string | null>(() =>
		transcript.players.some((player) => player.id === userId) ? userId : transcript.turnOrder[0],
	);
	const revealAll = perspective === null;
	const perspectivePlayerId = perspective ?? transcript.turnOrder[0];
	const [selectedCard, setSelectedCard] = useState<string | null>(null);
	const selectedMoveRef = useRef<HTMLButtonElement>(null);
	const moveListRef = useRef<HTMLDivElement>(null);
	const exitRef = useRef<HTMLButtonElement>(null);
	const steps = useMemo(() => {
		try {
			return getHanabiReviewSteps(transcript);
		} catch {
			return [];
		}
	}, [transcript]);
	const total = steps.length;
	const reconstruction = useMemo(() => {
		try {
			if (!isReplayableTranscript(transcript)) return null;
			return replayHanabiReview(transcript, cursor);
		} catch {
			return null;
		}
	}, [transcript, cursor]);
	const gameData = useMemo(
		() =>
			reconstruction ? projectHanabiReplay(reconstruction, perspectivePlayerId, revealAll) : null,
		[reconstruction, perspectivePlayerId, revealAll],
	);

	function goTo(next: number) {
		setCursor(Math.max(0, Math.min(total, next)));
		setSelectedCard(null);
	}

	useEffect(() => {
		exitRef.current?.focus();
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
			if (
				event.target instanceof HTMLElement &&
				event.target.closest('input, select, textarea, [contenteditable="true"]')
			)
				return;
			const offset = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : null;
			if (offset === null && event.key !== 'Home' && event.key !== 'End') return;
			event.preventDefault();
			setSelectedCard(null);
			setCursor((current) =>
				event.key === 'Home'
					? 0
					: event.key === 'End'
						? total
						: Math.max(0, Math.min(total, current + (offset ?? 0))),
			);
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [total]);

	useEffect(() => {
		const list = moveListRef.current;
		const row = selectedMoveRef.current;
		if (!list || !row) return;
		// Keep the selected row visible without scrolling the board or controls away.
		if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
		else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
			list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
		}
	}, [cursor]);

	const lastMove = steps[cursor - 1];
	const turnCount = gameData?.actions.length ?? 0;
	const caption = lastMove ? getReviewMoveLabel(lastMove, transcript) : 'Initial deal';
	const highlighted = new Set(
		lastMove
			? lastMove.type === 'reposition'
				? Object.keys(lastMove.positions)
				: lastMove.type === 'clue'
					? lastMove.selectedTileIds
					: [lastMove.tileId]
			: [],
	);
	const notes =
		selectedCard && gameData?.showNotes
			? getHanabiTileNotesDescription(gameData.tileNotes[selectedCard])
			: null;
	const finished = gameData?.stage === HanabiStage.Finished;
	const turnLabel = finished
		? 'Game over'
		: `${gameData?.players[gameData.currentPlayerId ?? '']?.name ?? 'Player'}'s turn${gameData?.remainingTurns != null ? ` · ${gameData.remainingTurns} ${gameData.remainingTurns === 1 ? 'turn' : 'turns'} left` : ''}`;

	return (
		<div className="hanabi-game-surface hanabi-review min-h-screen" data-review-cursor={cursor}>
			<header className="hanabi-review-header">
				<button ref={exitRef} type="button" onClick={onExit}>
					← {exitLabel}
				</button>
				<h1>Game review</h1>
				<div className="hanabi-review-perspective">
					<label>
						Perspective{' '}
						<select
							value={perspective === null ? 'all' : `player:${perspective}`}
							onChange={(event) => {
								setPerspective(
									event.target.value === 'all' ? null : event.target.value.slice('player:'.length),
								);
								setSelectedCard(null);
							}}
						>
							<option value="all">All hands</option>
							<hr />
							{transcript.turnOrder.map((id) => (
								<option key={id} value={`player:${id}`}>
									{transcript.players.find((player) => player.id === id)?.name ?? 'Player'}
								</option>
							))}
						</select>
					</label>
					{revealAll && <span>All hands revealed</span>}
				</div>
			</header>
			{!gameData ? (
				<p role="alert" className="hanabi-review-unavailable">
					Review unavailable: this round does not have a complete, valid finished transcript.
				</p>
			) : (
				<>
					<HanabiDesktopBoard
						gameData={gameData}
						userId={perspectivePlayerId}
						status={
							<HanabiDesktopStatus
								gameData={gameData}
								userId={perspectivePlayerId}
								turnLabel={turnLabel}
								showGameMenu={false}
							/>
						}
						tableau={<HanabiDesktopTableau gameData={gameData} highlightedTiles={highlighted} />}
						playerWorkspaces={
							<div aria-label="Player workspaces" className="hanabi-player-workspaces grid gap-1.5">
								{transcript.turnOrder.map((id) => (
									<HanabiPlayerWorkspace
										key={id}
										player={gameData.players[id]}
										active={!finished && gameData.currentPlayerId === id}
										finished={finished}
										isLocal={false}
										reviewPerspective={perspective === id}
										review
									>
										<div
											className="hanabi-review-hand hanabi-player-tile-surface relative overflow-hidden bg-hanabi-table/25"
											data-review-player={id}
											style={{ height: HANABI_DESKTOP_SURFACE_HEIGHT }}
										>
											{gameData.allowDragging && (
												<div
													aria-hidden="true"
													className="absolute bottom-0 left-0 right-0 border-t border-hanabi-border bg-hanabi-table-deep/18"
													data-review-hand-zone="freeform"
													style={{ top: HANABI_DESKTOP_ZONE_HEIGHT }}
												/>
											)}
											{gameData.playerTiles[id].map((tileId, index) => {
												const tile = gameData.tiles[tileId];
												const tileNotes = gameData.showNotes
													? gameData.tileNotes[tileId]
													: undefined;
												const hasNotes = Boolean(
													tileNotes && (tileNotes.colors.length || tileNotes.numbers.length),
												);
												const label = `${gameData.players[id].name}'s card ${index + 1}: ${tile.concealed ? 'hidden' : `${tile.color} ${tile.number}`}${gameData.showNotes ? `. ${getHanabiTileNotesDescription(tileNotes)}` : ''}`;
												return (
													<button
														type="button"
														className="hanabi-review-card"
														data-review-tile={tileId}
														style={{
															...getHanabiDesktopTileStyle({
																hidden: Boolean(tile.concealed),
																position: gameData.tilePositions[tileId],
																tileCount: gameData.playerTiles[id].length,
															}),
															zIndex: gameData.tilePositions[tileId].z,
														}}
														key={tileId}
														aria-label={label}
														aria-pressed={selectedCard === tileId}
														onClick={() => setSelectedCard(selectedCard === tileId ? null : tileId)}
														disabled={!gameData.showNotes}
													>
														<div className="hanabi-player-tile">
															<HanabiTileView
																color={tile.concealed ? undefined : tile.color}
																number={tile.concealed ? undefined : tile.number}
																dimensions={HANABI_DESKTOP_TILE_SIZE}
																notesIndicator={hasNotes}
															/>
														</div>
														{highlighted.has(tileId) && (
															<span className="hanabi-review-card-highlight" aria-hidden="true" />
														)}
													</button>
												);
											})}
										</div>
									</HanabiPlayerWorkspace>
								))}
							</div>
						}
						activity={
							<section className="hanabi-review-moves" aria-label="Move history">
								<h2>Review steps</h2>
								<div className="hanabi-review-move-list" ref={moveListRef}>
									<button
										type="button"
										aria-current={cursor === 0 ? 'step' : undefined}
										ref={cursor === 0 ? selectedMoveRef : undefined}
										onClick={() => goTo(0)}
									>
										<span>0</span>
										<span>Initial deal</span>
									</button>
									{steps.map((move, index) => (
										<button
											type="button"
											ref={cursor === index + 1 ? selectedMoveRef : undefined}
											key={move.type === 'reposition' ? move.id : move.actionId}
											aria-current={cursor === index + 1 ? 'step' : undefined}
											className={index >= cursor ? 'hanabi-review-future' : undefined}
											onClick={() => goTo(index + 1)}
										>
											<span>{index + 1}</span>
											<span>
												{index < cursor
													? getReviewMoveLabel(move, transcript)
													: `${gameData.players[move.actorId]?.name ?? 'Player'}'s next action`}
											</span>
										</button>
									))}
								</div>
								<p>Future moves hidden</p>
							</section>
						}
					/>
					<section className="hanabi-review-transport" aria-label="Review controls">
						<p className="hanabi-review-caption" aria-live="polite">
							{cursor
								? `${lastMove?.type === 'reposition' ? `Before turn ${turnCount + 1}` : `Turn ${turnCount}`} · `
								: ''}
							{caption}
							{finished &&
								` · Final score ${getHanabiScore(gameData)}/${getHanabiMaxScore(gameData.ruleSet)}`}
						</p>
						{notes && (
							<p className="hanabi-review-notes" role="status">
								{notes}
							</p>
						)}
						<div className="hanabi-review-controls">
							<button type="button" disabled={cursor === 0} onClick={() => goTo(0)}>
								Start
							</button>
							<button type="button" disabled={cursor === 0} onClick={() => goTo(cursor - 1)}>
								Previous
							</button>
							<input
								aria-label="Review position"
								aria-valuetext={`${cursor} of ${total} steps. ${finished ? turnLabel : `Before turn ${turnCount + 1}. ${turnLabel}`}`}
								type="range"
								min={0}
								max={total}
								step={1}
								value={cursor}
								onChange={(event) => goTo(Number(event.target.value))}
							/>
							<button type="button" disabled={cursor === total} onClick={() => goTo(cursor + 1)}>
								Next
							</button>
							<button type="button" disabled={cursor === total} onClick={() => goTo(total)}>
								End
							</button>
							<output aria-label="Step count">
								{cursor} / {total}
							</output>
						</div>
					</section>
				</>
			)}
		</div>
	);
}
