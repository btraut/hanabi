import { useSocket } from '~/components/SocketContext';
import HanabiCheckbox from '~/games/hanabi/client/design-system/HanabiCheckbox';
import HanabiDialog from '~/games/hanabi/client/design-system/HanabiDialog';
import HanabiLinkButton from '~/games/hanabi/client/design-system/HanabiLinkButton';
import HanabiMenuButton from '~/games/hanabi/client/design-system/HanabiMenuButton';
import HanabiCopyLinkButton from '~/games/hanabi/client/HanabiCopyLinkButton';
import {
	useGameData,
	useGameMessenger,
	useHanabiGameContext,
} from '~/games/hanabi/client/HanabiGameContext';
import { useHanabiOptionsContext } from '~/games/hanabi/client/HanabiOptionsContext';

interface Props {
	onClose: () => void;
}

export default function HanabiGameMenu({ onClose }: Props): JSX.Element | null {
	const gameMessenger = useGameMessenger();
	const gameData = useGameData();
	const { code } = useHanabiGameContext();
	const { userId } = useSocket();
	const { playSounds, setPlaySounds } = useHanabiOptionsContext();

	return (
		<HanabiDialog onClose={onClose} title="Game menu">
			<section className="hanabi-dialog-section">
				<div className="grid gap-3">
					{code && <HanabiCopyLinkButton link={code} variant="button" />}
					{userId && gameData.players[userId] ? (
						<HanabiMenuButton
							label="Restart game"
							onClick={() => {
								onClose();
								void gameMessenger.reset().catch((error: unknown) => {
									console.error('Could not reset the game:', error);
								});
							}}
							variant="danger"
							wide
						/>
					) : (
						<HanabiLinkButton href="/" label="Back to home" wide />
					)}
				</div>
			</section>
			<section className="hanabi-dialog-section">
				<h2 className="hanabi-dialog-section-title">Preferences</h2>
				<label
					className="flex cursor-pointer items-center justify-between gap-5 rounded-lg border border-hanabi-border bg-hanabi-table-deep/30 px-4 py-3 transition-colors hover:border-hanabi-border-bright"
					htmlFor="game-menu-play-sounds"
				>
					<span className="min-w-0">
						<span className="block text-[17px] font-semibold text-hanabi-text">Play sounds</span>
						<span className="block text-sm text-hanabi-text-muted">
							Sound effects and turn cues
						</span>
					</span>
					<HanabiCheckbox
						checked={playSounds}
						id="game-menu-play-sounds"
						onChange={(event) => setPlaySounds(event.target.checked)}
					/>
				</label>
			</section>
		</HanabiDialog>
	);
}
