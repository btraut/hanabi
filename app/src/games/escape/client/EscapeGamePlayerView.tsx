import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';

interface Props {
	gameManager: EscapeGameManager;
}

export default function EscapeGamePlayerView(_props: Props): JSX.Element {
	// useEffect(() => {
	// 	const data = await gameManager.getGameData();
	// }, []);

	return (
		<>
			<h1 className="HostView-Title">LFM</h1>
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
