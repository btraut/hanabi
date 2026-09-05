import { HanabiStage } from '@hanabi/shared';
import { useBotStatusData } from '~/games/hanabi/client/HanabiGameContext';
import HanabiPlayerWorkspace, {
	HanabiPlayerWorkspaceProps,
} from '~/games/hanabi/client/HanabiPlayerWorkspace';

export default function HanabiLivePlayerWorkspace(props: HanabiPlayerWorkspaceProps): JSX.Element {
	const gameData = useBotStatusData();
	const player = gameData.players[props.player.id] ?? props.player;
	const finished = gameData.finishedReason !== null;
	const turn = gameData.bots?.turn;
	const thinking =
		!finished &&
		gameData.stage === HanabiStage.Playing &&
		(gameData.currentPlayerId === player.id || turn?.opportunity === 'clue') &&
		player.kind === 'bot' &&
		turn?.playerId === player.id &&
		turn.status === 'thinking';

	return (
		<HanabiPlayerWorkspace
			{...props}
			active={!finished && gameData.currentPlayerId === player.id}
			finished={finished}
			player={player}
			thinking={thinking}
			thinkingLabel={turn?.opportunity === 'clue' ? 'Considering clue…' : 'Thinking…'}
		/>
	);
}
