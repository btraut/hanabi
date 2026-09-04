import HanabiDesktopBoard from '~/games/hanabi/client/HanabiDesktopBoard';
import HanabiActivityRail from '~/games/hanabi/client/HanabiActivityRail';
import { HANABI_BRAND_MARK_PATH } from '~/games/hanabi/client/HanabiArtwork';
import PaperPlane from '~/games/hanabi/client/icons/PaperPlane';
import HanabiDesktopTableau from '~/games/hanabi/client/HanabiDesktopTableau';
import {
	HanabiGameContext,
	HanabiGameContextProvider,
} from '~/games/hanabi/client/HanabiGameContext';
import HanabiGameMessenger from '~/games/hanabi/client/HanabiGameMessenger';
import { HanabiHighlightContextProvider } from '~/games/hanabi/client/HanabiHighlightContext';
import { HanabiDesktopPlayerWorkspaces } from '~/games/hanabi/client/HanabiPlayerWorkspace';
import { hasHanabiTileNotes } from '~/games/hanabi/client/HanabiPlayerTiles';
import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import {
	HANABI_DESKTOP_SURFACE_HEIGHT,
	HANABI_DESKTOP_TILE_SIZE,
	HANABI_DESKTOP_ZONE_HEIGHT,
	getHanabiDesktopTileStyle,
} from '~/games/hanabi/client/HanabiDesktopTileGeometry';
import {
	getHanabiDesktopFixtures,
	HanabiDesktopFixtureName,
} from '~/games/hanabi/client/dev/HanabiDesktopFixtures';
import Error404Page from '~/pages/Error404Page';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function HanabiDesktopFixtureView(): JSX.Element {
	const { fixture: fixtureName } = useParams();
	const fixtures = getHanabiDesktopFixtures();
	const fixture = fixtures[fixtureName as HanabiDesktopFixtureName];
	const [highlightedAction, highlightAction] = useState<string | null>(null);
	const highlightContext = useMemo(
		() => ({
			highlightAction,
			highlightedAction,
			highlightedLabel: null,
			highlightedRecipientId: null,
			highlightedTiles: new Set<string>(),
			highlightedTone: null,
		}),
		[highlightedAction],
	);
	const fixtureGameContext = useMemo<HanabiGameContext | null>(
		() =>
			fixture
				? {
						code: fixture.code,
						create: () => Promise.resolve(fixture.code),
						gameData: fixture.gameData,
						gameMessenger: {
							reset: () => Promise.resolve(),
						} as HanabiGameMessenger,
						transitioningTileId: null,
						watch: () => Promise.resolve(),
					}
				: null,
		[fixture],
	);

	if (!fixture || !fixtureGameContext) return <Error404Page />;

	return (
		<HanabiGameContextProvider value={fixtureGameContext}>
			<HanabiHighlightContextProvider value={highlightContext}>
				<div className="hanabi-game-surface min-h-screen">
					<header className="hanabi-game-header h-[70px] border-b border-hanabi-border bg-hanabi-table-deep/70">
						<div className="hanabi-game-header-inner mx-auto flex h-full max-w-[1660px] items-center justify-between gap-6 px-5">
							<div className="hanabi-game-brand flex min-w-0 items-center gap-2.5">
								<img
									alt=""
									className="hanabi-game-brand-mark size-12"
									src={HANABI_BRAND_MARK_PATH}
								/>
								<span className="hanabi-game-brand-name text-[32px] font-medium tracking-[-0.025em] text-hanabi-text">
									Hanabi
								</span>
							</div>
							<div className="hanabi-game-header-actions flex min-w-0 items-center gap-5">
								<div className="flex items-center gap-3 text-sm">
									<span className="hanabi-game-code-label text-hanabi-coral-soft">Game code</span>
									<span className="font-mono text-lg tracking-[0.08em] text-hanabi-text">
										{fixture.code}
									</span>
									<span aria-hidden="true" className="relative block h-6 w-5">
										<span className="absolute left-0 top-0 size-4 rounded-sm border border-hanabi-text" />
										<span className="absolute bottom-0 right-0 size-4 rounded-sm border border-hanabi-text bg-hanabi-table-deep" />
									</span>
								</div>
								<div
									aria-hidden="true"
									className="grid h-12 w-14 content-center justify-center gap-1.5 rounded-lg border border-hanabi-border"
								>
									<span className="block h-px w-5 bg-hanabi-text" />
									<span className="block h-px w-5 bg-hanabi-text" />
									<span className="block h-px w-5 bg-hanabi-text" />
								</div>
							</div>
						</div>
					</header>
					<div className="hanabi-game-board-shell pt-5">
						<HanabiDesktopBoard
							activity={
								<HanabiActivityRail
									composer={
										<div className="hanabi-chat-input">
											<div className="hanabi-chat-field">
												<div className="hanabi-chat-textarea text-hanabi-text-muted">
													Message the table…
												</div>
											</div>
											<div className="hanabi-chat-send opacity-40">
												<PaperPlane size={23} />
											</div>
										</div>
									}
									gameData={fixture.gameData}
									userId={fixture.userId}
								/>
							}
							gameData={fixture.gameData}
							playerWorkspaces={
								<HanabiDesktopPlayerWorkspaces
									gameData={fixture.gameData}
									renderTileSurface={(playerId) => (
										<div
											className="relative overflow-visible bg-hanabi-table/25"
											style={{ height: HANABI_DESKTOP_SURFACE_HEIGHT, width: '100%' }}
										>
											<div
												aria-hidden="true"
												className="absolute inset-x-0 bottom-0 border-t border-hanabi-border bg-hanabi-table-deep/18"
												style={{ bottom: 0, top: HANABI_DESKTOP_ZONE_HEIGHT }}
											/>
											{fixture.gameData.playerTiles[playerId].map((tileId) => {
												const position = fixture.gameData.tilePositions[tileId];
												const tile = fixture.gameData.tiles[tileId];
												return (
													<div
														className="absolute left-0 top-0"
														key={tileId}
														style={{
															...getHanabiDesktopTileStyle({
																hidden: fixture.userId === playerId,
																position,
																tileCount: fixture.gameData.playerTiles[playerId].length,
															}),
															zIndex: position.z,
														}}
													>
														<div className="hanabi-player-tile">
															<HanabiTileView
																color={fixture.userId === playerId ? undefined : tile.color}
																dimensions={HANABI_DESKTOP_TILE_SIZE}
																notesIndicator={
																	fixture.userId === playerId &&
																	hasHanabiTileNotes(fixture.gameData.tileNotes[tileId])
																}
																number={fixture.userId === playerId ? undefined : tile.number}
															/>
														</div>
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
					<div id="portal" />
				</div>
			</HanabiHighlightContextProvider>
		</HanabiGameContextProvider>
	);
}
