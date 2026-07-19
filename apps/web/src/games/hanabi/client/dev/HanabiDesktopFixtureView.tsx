import HanabiDesktopBoard from '~/games/hanabi/client/HanabiDesktopBoard';
import HanabiActivityRail from '~/games/hanabi/client/HanabiActivityRail';
import HanabiDesktopTableau from '~/games/hanabi/client/HanabiDesktopTableau';
import { HanabiDesktopPlayerWorkspaces } from '~/games/hanabi/client/HanabiPlayerWorkspace';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import {
	getHanabiDesktopFixtures,
	HanabiDesktopFixtureName,
} from '~/games/hanabi/client/dev/HanabiDesktopFixtures';
import Error404Page from '~/pages/Error404Page';
import { HANABI_BOARD_SIZE, HANABI_WORKSPACE_ZONE_BOUNDARY } from '@hanabi/shared';
import { Link, useParams } from 'react-router-dom';

export default function HanabiDesktopFixtureView(): JSX.Element {
	const { fixture: fixtureName } = useParams();
	const fixtures = getHanabiDesktopFixtures();
	const fixture = fixtures[fixtureName as HanabiDesktopFixtureName];

	if (!fixture) return <Error404Page />;

	return (
		<div className="hanabi-game-surface min-h-screen py-5">
			<header className="mx-auto mb-4 flex w-[calc(100vw-32px)] max-w-[1240px] items-start justify-between gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-hanabi-coral-soft">
						Development fixture
					</p>
					<h1 className="text-lg font-semibold text-hanabi-text">{fixture.name}</h1>
					<p className="text-sm text-hanabi-text-muted">{fixture.description}</p>
				</div>
				<nav aria-label="Desktop fixtures" className="flex max-w-xl flex-wrap justify-end gap-1.5">
					{Object.values(fixtures).map((item) => (
						<Link
							className="hanabi-focus-ring rounded-md border border-hanabi-border px-2 py-1 text-xs text-hanabi-text-muted hover:border-hanabi-border-bright hover:text-hanabi-text"
							key={item.name}
							to={`/dev/desktop/${item.name}`}
						>
							{item.name}
						</Link>
					))}
				</nav>
			</header>
			<HanabiDesktopBoard
				activity={
					<HanabiActivityRail
						composer={<div className="p-3 text-xs text-hanabi-text-muted">Message composer</div>}
						gameData={fixture.gameData}
						renderAction={(action) => (
							<p className="p-3 text-sm text-hanabi-text">{action.type}</p>
						)}
						userId={fixture.userId}
					/>
				}
				gameData={fixture.gameData}
				playerWorkspaces={
					<HanabiDesktopPlayerWorkspaces
						gameData={fixture.gameData}
						renderTileSurface={(playerId) => (
							<div className="relative overflow-hidden bg-hanabi-ivory" style={HANABI_BOARD_SIZE}>
								<div
									aria-hidden="true"
									className="absolute inset-x-0 bottom-0 border-t border-hanabi-border/35 bg-hanabi-ink/8"
									style={{ height: HANABI_BOARD_SIZE.height - HANABI_WORKSPACE_ZONE_BOUNDARY }}
								/>
								{fixture.gameData.playerTiles[playerId].map((tileId) => {
									const position = fixture.gameData.tilePositions[tileId];
									const tile = fixture.gameData.tiles[tileId];
									return (
										<div
											className="absolute left-0 top-0"
											key={tileId}
											style={{
												transform: `translate(${position.x}px, ${position.y}px)`,
												zIndex: position.z,
											}}
										>
											<HanabiTileView
												color={fixture.userId === playerId ? undefined : tile.color}
												number={fixture.userId === playerId ? undefined : tile.number}
											/>
										</div>
									);
								})}
							</div>
						)}
						userId={fixture.userId}
					/>
				}
				tableau={<HanabiDesktopTableau gameData={fixture.gameData} />}
				userId={fixture.userId}
			/>
		</div>
	);
}
