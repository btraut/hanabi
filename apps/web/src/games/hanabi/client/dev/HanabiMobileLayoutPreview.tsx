import {
	generateHanabiGameData,
	getHanabiFireworkSequence,
	getHanabiRuleSetColors,
	getHanabiTileCopyCount,
	HanabiGameActionType,
	HanabiGameData,
	HanabiRuleSet,
	HanabiStage,
	HanabiTile,
	HanabiTileColor,
	HanabiTileNumber,
} from '@hanabi/shared';
import { CSSProperties, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import HanabiDesktopBoard from '../HanabiDesktopBoard';
import HanabiDesktopStatus, {
	ClueStatusIcon,
	LifeStatusIcon,
	getHanabiDesktopStatusData,
} from '../HanabiDesktopStatus';
import HanabiDeck from '../HanabiDeck';
import Star from '../icons/Star';
import HanabiDesktopTableau, {
	getHanabiDiscardsForColor,
	getHanabiPlayedTopTile,
} from '../HanabiDesktopTableau';
import { HanabiDesktopPlayerWorkspaces } from '../HanabiPlayerWorkspace';
import HanabiPlayerAvatar from '../HanabiPlayerAvatar';
import HanabiTileView from '../HanabiTileView';
import HanabiDialog from '../design-system/HanabiDialog';
import { getHanabiRecentTileClue } from '../HanabiRecentClue';
import './mobile-layout-preview.css';

const variants = [
	['5-color', 'Five colors'],
	['6-color', 'Six colors'],
	['rainbow-black-powder', 'Rainbow + black'],
] as const;
const ranks: readonly HanabiTileNumber[] = [1, 2, 3, 4, 5];

function makePreviewGame(ruleSet: HanabiRuleSet, manyDiscards: boolean): HanabiGameData {
	const tiles: Record<string, HanabiTile> = {};
	const pool: HanabiTile[] = [];
	const colors = getHanabiRuleSetColors(ruleSet);
	for (const color of colors)
		for (const number of ranks) {
			for (let copy = 0; copy < getHanabiTileCopyCount(color, number); copy++) {
				const tile = { id: `${color}-${number}-${copy}`, color, number };
				tiles[tile.id] = tile;
				pool.push(tile);
			}
		}
	const take = (color: HanabiTileColor, number: HanabiTileNumber) => {
		const index = pool.findIndex((tile) => tile.color === color && tile.number === number);
		if (index < 0) throw new Error(`Missing preview card: ${color} ${number}`);
		return pool.splice(index, 1)[0].id;
	};
	const playedTiles = colors.flatMap((color, index) =>
		getHanabiFireworkSequence(color)
			.slice(0, [3, 2, 4, 1, 0, 1, 2][index])
			.map((number) => take(color, number)),
	);
	const discardedTiles = [
		take('red', 1),
		take('blue', 1),
		take('green', 1),
		take('red', 1),
		take('yellow', 3),
		take('white', 1),
		take('blue', 3),
	];
	const ownHand = [
		take('red', 2),
		take('green', 3),
		take('blue', 4),
		take('white', 5),
		take('yellow', 2),
	];
	const partnerHand = [
		take('red', 4),
		take('blue', 3),
		take('green', 5),
		take('yellow', 4),
		take('white', 2),
	];
	if (manyDiscards) {
		for (const color of colors) {
			const extras = pool.filter((tile) => tile.color === color).slice(0, -1);
			for (const tile of extras) discardedTiles.push(take(tile.color, tile.number));
		}
	}
	return generateHanabiGameData({
		ruleSet,
		stage: HanabiStage.Playing,
		currentPlayerId: 'you',
		clues: 5,
		lives: 2,
		players: {
			you: { id: 'you', name: 'Brent', connected: true },
			timur: { id: 'timur', name: 'Timur', connected: true },
		},
		turnOrder: ['you', 'timur'],
		tiles,
		playedTiles,
		discardedTiles,
		playerTiles: { you: ownHand, timur: partnerHand },
		remainingTiles: pool.map((tile) => tile.id),
		actions: [
			{
				id: 'latest',
				type: HanabiGameActionType.GiveNumberClue,
				playerId: 'timur',
				recipientId: 'you',
				number: 2,
				tiles: ownHand.filter((id) => tiles[id].number === 2).map((id) => tiles[id]),
			},
		],
	});
}

export default function HanabiMobileLayoutPreview(): JSX.Element {
	const [params] = useSearchParams();
	const [variant, setVariant] = useState<HanabiRuleSet>('5-color');
	const [short, setShort] = useState(false);
	const [manyDiscards, setManyDiscards] = useState(params.get('discards') === 'many');
	const embedded = params.get('view');
	const ruleSet = variants.find(([value]) => value === params.get('rules'))?.[0] ?? '5-color';
	if (embedded === 'current' || embedded === 'compact') {
		return (
			<PhoneBoard
				key={`${embedded}-${ruleSet}-${params.get('discards')}`}
				compact={embedded === 'compact'}
				ruleSet={ruleSet}
				manyDiscards={params.get('discards') === 'many'}
			/>
		);
	}
	return (
		<main className="mobile-study">
			<header className="mobile-study-intro">
				<p className="mobile-study-eyebrow">HANABI · MOBILE LAYOUT STUDY</p>
				<h1>The whole table. One screen.</h1>
				<p>Keep the counts in sight. Turn the tableau sideways. Give the hands the room.</p>
				<div className="mobile-study-controls">
					<label>
						Game{' '}
						<select
							value={variant}
							onChange={(event) => setVariant(event.target.value as HanabiRuleSet)}
						>
							{variants.map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
					</label>
					<label>
						<input
							type="checkbox"
							checked={short}
							onChange={(event) => setShort(event.target.checked)}
						/>{' '}
						Shorter screen
					</label>
					<label>
						<input
							type="checkbox"
							checked={manyDiscards}
							onChange={(event) => setManyDiscards(event.target.checked)}
						/>{' '}
						Many discards
					</label>
					<a
						href={`/dev/mobile-layout?view=compact&rules=${variant}&discards=${manyDiscards ? 'many' : 'few'}`}
						target="_blank"
						rel="noreferrer"
					>
						Open prototype ↗
					</a>
				</div>
			</header>
			<div className="mobile-study-comparison">
				{(['current', 'compact'] as const).map((view) => (
					<section key={view}>
						<div className="mobile-study-caption">
							<h2>{view === 'current' ? 'Current layout' : 'Compact proposal'}</h2>
							<span>402 × {short ? 620 : 740}</span>
						</div>
						<iframe
							title={
								view === 'current' ? 'Current mobile game layout' : 'Compact mobile game prototype'
							}
							src={`/dev/mobile-layout?view=${view}&rules=${variant}&discards=${manyDiscards ? 'many' : 'few'}`}
							style={{ height: short ? 620 : 740 }}
						/>
						<p className="mobile-study-note">
							{view === 'current'
								? 'Existing tableau and status components. Scroll to find both hands.'
								: 'Tap a stack for discards. Tap your cards to try the arrangement space.'}
						</p>
					</section>
				))}
			</div>
			<p className="mobile-study-footnote">
				Local interaction prototype · same sample game in both views · full-size hand cards and
				184px arrangement surfaces · no live game actions
			</p>
		</main>
	);
}

function PhoneBoard({
	compact,
	ruleSet,
	manyDiscards,
}: {
	compact: boolean;
	ruleSet: HanabiRuleSet;
	manyDiscards: boolean;
}): JSX.Element {
	const game = useMemo(() => makePreviewGame(ruleSet, manyDiscards), [ruleSet, manyDiscards]);
	const status = getHanabiDesktopStatusData(game, 'you');
	const [detail, setDetail] = useState<HanabiTileColor | 'activity' | 'menu' | null>(null);
	const [parked, setParked] = useState<ReadonlySet<string>>(
		() => new Set([game.playerTiles.you[4]]),
	);
	const colors = getHanabiRuleSetColors(ruleSet);
	const renderHand = (playerId: string) => (
		<div
			className="mobile-study-hand"
			aria-label={`${playerId === 'you' ? 'Your' : 'Timur’s'} card arrangement`}
		>
			<div className="mobile-study-parking" />
			{game.playerTiles[playerId].map((id, index) => {
				const tile = game.tiles[id];
				const hidden = playerId === 'you';
				const below = hidden ? parked.has(id) : index === 4;
				const clue = hidden ? getHanabiRecentTileClue(game.actions, 'you', id) : undefined;
				const Comp = hidden ? 'button' : 'div';
				return (
					<Comp
						key={id}
						className="mobile-study-hand-card"
						aria-label={
							hidden
								? `Your card ${index + 1}${clue ? `, clue ${clue.value}` : ''}, ${below ? 'return to row' : 'move to workspace'}`
								: `${tile.color} ${tile.number}`
						}
						style={{
							left: below ? `${Math.min(index * 17, 68)}%` : 8 + index * 56,
							top: below ? 106 : 8,
						}}
						onClick={
							hidden
								? () =>
										setParked((previous) => {
											const next = new Set(previous);
											if (next.has(id)) next.delete(id);
											else next.add(id);
											return next;
										})
								: undefined
						}
					>
						<HanabiTileView
							color={hidden ? undefined : tile.color}
							number={hidden ? undefined : tile.number}
							dimensions={{ width: 50, height: 64 }}
							recentClue={clue}
							highlight={!!clue}
							highlightTone="number"
							notesIndicator={hidden && index === 3}
						/>
					</Comp>
				);
			})}
		</div>
	);
	return (
		<div
			className={`hanabi-game-surface mobile-study-phone ${compact ? 'mobile-study-compact' : 'mobile-study-current'}`}
		>
			{compact ? (
				<>
					<header className="mobile-study-pinned">
						<div className="mobile-study-turn">
							<span>
								<i /> Your turn
							</span>
							<button onClick={() => setDetail('menu')} aria-label="Game menu">
								•••
							</button>
						</div>
						<dl className="mobile-study-counts">
							{[
								{ label: 'Clues', value: status.clues, icon: <ClueStatusIcon /> },
								{ label: 'Deck', value: status.deck, icon: <HanabiDeck count={status.deck} /> },
								{ label: 'Lives', value: status.lives, icon: <LifeStatusIcon /> },
								{
									label: 'Score',
									value: `${status.score}/${status.maxScore}`,
									icon: <Star size={26} />,
								},
							].map(({ label, value, icon }) => (
								<div key={label} title={label}>
									<dt>
										<span className="sr-only">{label}</span>
										{icon}
									</dt>
									<dd>{value}</dd>
								</div>
							))}
						</dl>
					</header>
					<div className="mobile-study-table">
						<section aria-label="Fireworks and discards" className="mobile-study-tableau">
							<div
								className="mobile-study-stacks"
								style={{ '--study-colors': colors.length } as CSSProperties}
							>
								{colors.map((color) => {
									const top = getHanabiPlayedTopTile(game, color);
									const discards = getHanabiDiscardsForColor(game, color);
									return (
										<button
											key={color}
											className="mobile-study-stack"
											aria-label={`${color}, ${top ? `played ${top.number}` : 'not started'}, ${discards.length} discards. Inspect pile`}
											onClick={() => setDetail(color)}
										>
											<HanabiTileView
												color={color}
												number={top?.number ?? getHanabiFireworkSequence(color)[0]}
												placeholder={!top}
												dimensions={{
													width: colors.length === 7 ? 40 : 46,
													height: colors.length === 7 ? 51.2 : 58.88,
												}}
											/>
											<span className="mobile-study-discards">
												{discards.length
													? discards.map((tile) => <span key={tile.id}>{tile.number}</span>)
													: '—'}
											</span>
										</button>
									);
								})}
							</div>
						</section>
						<div className="mobile-study-hands">
							{game.turnOrder.map((id) => (
								<section
									className={`mobile-study-workspace ${id === 'you' ? 'is-active' : ''}`}
									key={id}
								>
									<header>
										<HanabiPlayerAvatar player={game.players[id]} size="sm" showName={false} />
										<h2>{id === 'you' ? 'You' : 'Timur'}</h2>
										<span>{id === 'you' ? 'Your turn' : 'Waiting'}</span>
									</header>
									{renderHand(id)}
								</section>
							))}
						</div>
					</div>
					<button className="mobile-study-activity" onClick={() => setDetail('activity')}>
						<span>
							<strong>Timur → You</strong> Gave a 2 clue
						</span>
						<span>Activity ↗</span>
					</button>
				</>
			) : (
				<div className="hanabi-game-board-shell">
					<HanabiDesktopBoard
						gameData={game}
						userId="you"
						status={<HanabiDesktopStatus gameData={game} userId="you" showGameMenu={false} />}
						tableau={<HanabiDesktopTableau gameData={game} />}
						playerWorkspaces={
							<HanabiDesktopPlayerWorkspaces
								gameData={game}
								userId="you"
								renderTileSurface={renderHand}
							/>
						}
					/>
					<button className="mobile-study-current-chat" onClick={() => setDetail('activity')}>
						Activity
					</button>
				</div>
			)}
			{detail && (
				<HanabiDialog
					title={
						detail === 'activity'
							? 'Activity'
							: detail === 'menu'
								? 'Game menu'
								: `${detail.charAt(0).toUpperCase() + detail.slice(1)} pile`
					}
					onClose={() => setDetail(null)}
				>
					{detail === 'activity' ? (
						<p>Timur gave you a 2 clue, touching two cards.</p>
					) : detail === 'menu' ? (
						<p>Layout prototype · two players · {colors.length} colors.</p>
					) : (
						<>
							<p>
								{getHanabiPlayedTopTile(game, detail)
									? `Played through ${getHanabiPlayedTopTile(game, detail)!.number}.`
									: 'No cards played.'}
								{detail === 'black' ? ' Black plays from 5 down to 1.' : ''}
							</p>
							<h2 className="mobile-study-detail-title">Discards · oldest first</h2>
							<div className="mobile-study-detail-cards">
								{getHanabiDiscardsForColor(game, detail).map((tile) => (
									<HanabiTileView
										key={tile.id}
										color={tile.color}
										number={tile.number}
										dimensions={{ width: 50, height: 64 }}
									/>
								))}
								{getHanabiDiscardsForColor(game, detail).length === 0 && <p>No discards.</p>}
							</div>
						</>
					)}
				</HanabiDialog>
			)}
			<div id="portal" />
		</div>
	);
}
