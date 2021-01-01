import { useEscapeGameManager } from 'app/src/games/escape/client/EscapeGameManagerContext';
import EscapeGameStage from 'app/src/games/escape/EscapeGameStage';

export default function EscapeGamePlayerView(): JSX.Element {
	const gameManager = useEscapeGameManager();

	const title = gameManager.gameData?.stage === EscapeGameStage.Open ? 'LFM' : 'Game in progress!';

	return (
		<>
			<h1 className="HostView-Title">{title}</h1>
			<ul className="HostView-PlayersContainer">
				{/* {data.players.map((player) => (
					<li className="HostView-Player" key={player.id}>
						{player.pictureData && (
							<img className="HostView-PlayerPicture" src={player.pictureData} />
						)}
						{!player.pictureData && (
							<img className="HostView-PlayerPicture" src="/images/drawing-face.svg" />
						)}
						<div className="HostView-PlayerName">{player.name}</div>
					</li>
				))} */}
			</ul>
		</>
	);
}
