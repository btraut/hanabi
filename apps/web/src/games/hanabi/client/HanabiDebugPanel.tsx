import { useUserId } from '~/components/SocketContext';
import { useGameData, useGameMessenger } from '~/games/hanabi/client/HanabiGameContext';
import HanabiTileView, { TileViewSize } from '~/games/hanabi/client/HanabiTileView';
import {
	DebugPlayerAction,
	HANABI_CLUE_COLORS,
	HanabiClueColor,
	HanabiRuleSet,
	HanabiStage,
	HanabiTile,
	HanabiTileNumber,
	isHanabiRainbowRuleSet,
	tileBackgroundClasses,
} from '@hanabi/shared';
import classNames from 'classnames';
import { useCallback, useState } from 'react';

const DEBUG_PLAYER_NAME = 'Debug Player';
const LEGAL_CLUE_COLORS: readonly HanabiClueColor[] = HANABI_CLUE_COLORS;
const CLUE_NUMBERS: readonly HanabiTileNumber[] = [1, 2, 3, 4, 5];

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'The debug command failed.';
}

function colorSelectsTile(
	color: HanabiClueColor,
	tile: HanabiTile,
	ruleSet: HanabiRuleSet,
): boolean {
	return tile.color === color || (isHanabiRainbowRuleSet(ruleSet) && tile.color === 'rainbow');
}

type DebugButtonProps = {
	children: React.ReactNode;
	disabled: boolean;
	label: string;
	onClick: () => void;
	compact?: boolean;
};

function DebugButton({
	children,
	disabled,
	label,
	onClick,
	compact = false,
}: DebugButtonProps): JSX.Element {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onClick={onClick}
			className={classNames(
				'rounded-md border-2 font-bold uppercase transition focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900',
				compact ? 'min-h-8 px-2 py-1 text-xs' : 'min-h-10 px-3 py-2 text-sm',
				disabled
					? 'cursor-not-allowed border-gray-600 text-gray-500'
					: 'border-white text-white hover:border-red-500 hover:bg-red-700 active:scale-95',
			)}
		>
			{children}
		</button>
	);
}

export default function HanabiDebugPanel(): JSX.Element | null {
	const userId = useUserId();
	const gameData = useGameData();
	const gameMessenger = useGameMessenger();
	const [pending, setPending] = useState(false);
	const [status, setStatus] = useState('');
	const [error, setError] = useState('');

	const debugPlayerId = `debug:${gameData.creatorId}`;
	const debugPlayer = gameData.players[debugPlayerId];
	const isJoinedCreator = userId === gameData.creatorId && !!gameData.players[userId];

	const runCommand = useCallback(
		async (command: () => Promise<unknown>, successMessage: string) => {
			if (pending) {
				return;
			}

			setPending(true);
			setError('');
			setStatus('Sending debug command…');
			try {
				await command();
				setStatus(successMessage);
			} catch (commandError) {
				setStatus('');
				setError(getErrorMessage(commandError));
			} finally {
				setPending(false);
			}
		},
		[pending],
	);

	const sendAction = useCallback(
		(action: DebugPlayerAction, successMessage: string) =>
			runCommand(() => gameMessenger.debugPlayerAction(action), successMessage),
		[gameMessenger, runCommand],
	);

	if (!isJoinedCreator) {
		return null;
	}

	const fakeTurn = gameData.currentPlayerId === debugPlayerId;
	const actionsEnabled =
		gameData.stage === HanabiStage.Playing && fakeTurn && !!debugPlayer && !pending;
	const fakeTiles = (gameData.playerTiles[debugPlayerId] ?? []).map(
		(tileId) => gameData.tiles[tileId],
	);
	const clueRecipients = Object.values(gameData.players).filter(
		(player) => player.id !== debugPlayerId,
	);

	return (
		<aside className="fixed bottom-3 left-3 right-3 z-20 max-h-[min(34rem,calc(100vh-1.5rem))] overflow-auto rounded-xl border-4 border-black bg-gray-900 text-white shadow-dark sm:left-auto sm:w-[24rem]">
			<details open>
				<summary className="sticky top-0 z-10 cursor-pointer select-none rounded-t-lg bg-red-900 px-4 py-3 font-bold uppercase tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white">
					{DEBUG_PLAYER_NAME} Controls
				</summary>
				<div className="grid gap-4 p-4">
					{gameData.stage === HanabiStage.Setup && (
						<section aria-labelledby="debug-player-setup-heading" className="grid gap-3">
							<h2 id="debug-player-setup-heading" className="font-bold">
								Setup
							</h2>
							{debugPlayer ? (
								<p className="text-sm text-gray-300">
									{DEBUG_PLAYER_NAME} is in the lobby and ready to start.
								</p>
							) : (
								<DebugButton
									disabled={pending}
									label={`Add ${DEBUG_PLAYER_NAME}`}
									onClick={() => {
										void runCommand(
											() => gameMessenger.createDebugPlayer(),
											`${DEBUG_PLAYER_NAME} added.`,
										);
									}}
								>
									Add {DEBUG_PLAYER_NAME}
								</DebugButton>
							)}
						</section>
					)}

					{gameData.stage === HanabiStage.Playing && !debugPlayer && (
						<p className="text-sm text-amber-300">
							No debug player was added before the game started.
						</p>
					)}

					{gameData.stage === HanabiStage.Playing && debugPlayer && (
						<>
							<p className={fakeTurn ? 'font-bold text-green-300' : 'text-sm text-gray-300'}>
								{fakeTurn
									? `${DEBUG_PLAYER_NAME}'s turn — choose an action.`
									: `Waiting for ${gameData.players[gameData.currentPlayerId ?? '']?.name ?? 'the current player'}.`}
							</p>

							{fakeTurn && (
								<>
									<section aria-labelledby="debug-player-hand-heading" className="grid gap-2">
										<h2
											id="debug-player-hand-heading"
											className="text-sm font-bold uppercase text-gray-300"
										>
											Hand
										</h2>
										<div className="grid gap-2">
											{fakeTiles.map((tile, index) => (
												<div
													key={tile.id}
													className="flex items-center gap-3 rounded-lg bg-black/30 p-2"
												>
													<HanabiTileView
														color={tile.color}
														number={tile.number}
														size={TileViewSize.Small}
													/>
													<span className="sr-only">Card {index + 1}</span>
													<div className="ml-auto flex gap-2">
														<DebugButton
															compact
															disabled={!actionsEnabled}
															label={`Play card ${index + 1}, ${tile.color} ${tile.number}`}
															onClick={() => {
																void sendAction(
																	{ type: 'play', tileId: tile.id },
																	`Played card ${index + 1}.`,
																);
															}}
														>
															Play
														</DebugButton>
														<DebugButton
															compact
															disabled={!actionsEnabled}
															label={`Discard card ${index + 1}, ${tile.color} ${tile.number}`}
															onClick={() => {
																void sendAction(
																	{ type: 'discard', tileId: tile.id },
																	`Discarded card ${index + 1}.`,
																);
															}}
														>
															Discard
														</DebugButton>
													</div>
												</div>
											))}
										</div>
									</section>

									<section aria-labelledby="debug-player-clues-heading" className="grid gap-3">
										<h2
											id="debug-player-clues-heading"
											className="text-sm font-bold uppercase text-gray-300"
										>
											Clues
										</h2>
										{gameData.clues === 0 ? (
											<p className="text-sm text-gray-400">No clues remaining.</p>
										) : (
											clueRecipients.map((recipient) => {
												const recipientTiles = (gameData.playerTiles[recipient.id] ?? []).map(
													(tileId) => gameData.tiles[tileId],
												);
												const validColors = LEGAL_CLUE_COLORS.filter((color) =>
													recipientTiles.some((tile) =>
														colorSelectsTile(color, tile, gameData.ruleSet),
													),
												);
												const validNumbers = CLUE_NUMBERS.filter((number) =>
													recipientTiles.some((tile) => tile.number === number),
												);

												return (
													<fieldset
														key={recipient.id}
														className="grid gap-2 rounded-lg border-2 border-gray-700 p-3"
													>
														<legend className="px-1 text-sm font-bold">To {recipient.name}</legend>
														{validColors.length + validNumbers.length === 0 ? (
															<p className="text-sm text-gray-400">No valid clues for this hand.</p>
														) : (
															<div className="flex flex-wrap items-center gap-2">
																{validColors.map((color) => (
																	<button
																		type="button"
																		key={color}
																		aria-label={`Give ${recipient.name} a ${color} clue`}
																		title={`${color} clue`}
																		disabled={!actionsEnabled}
																		onClick={() => {
																			void sendAction(
																				{ type: 'clue', to: recipient.id, color },
																				`Gave ${recipient.name} a ${color} clue.`,
																			);
																		}}
																		className={classNames(
																			'h-9 w-9 rounded-full border-4 border-black shadow-light focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-30',
																			tileBackgroundClasses[color],
																		)}
																	/>
																))}
																{validNumbers.map((number) => (
																	<DebugButton
																		key={number}
																		compact
																		disabled={!actionsEnabled}
																		label={`Give ${recipient.name} a number ${number} clue`}
																		onClick={() => {
																			void sendAction(
																				{ type: 'clue', to: recipient.id, number },
																				`Gave ${recipient.name} a number ${number} clue.`,
																			);
																		}}
																	>
																		{number}
																	</DebugButton>
																))}
															</div>
														)}
													</fieldset>
												);
											})
										)}
									</section>
								</>
							)}
						</>
					)}

					{gameData.stage === HanabiStage.Finished && (
						<p className="text-sm text-gray-300">Game finished. Debug actions are read-only.</p>
					)}

					<div aria-live="polite" aria-atomic="true" className="min-h-5 text-sm">
						{error ? <p className="font-bold text-red-300">{error}</p> : <p>{status}</p>}
					</div>
				</div>
			</details>
		</aside>
	);
}
