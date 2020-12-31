import EscapeGameManager from 'app/src/games/escape/client/EscapeGameManager';
import useAsyncEffect from 'app/src/utils/client/useAsyncEffect';
import { useHistory } from 'react-router';

// Define globals from webpack.
declare const DOMAIN_BASE: string;

interface Props {
	gameManager: EscapeGameManager;
}

export default function EscapeGameHostView({ gameManager }: Props): JSX.Element {
	const history = useHistory();

	useAsyncEffect(async () => {
		if (!gameManager.gameId) {
			// TODO: Reconnect with game
			history.push('/escape');
		}
	}, [gameManager.gameId, history]);

	return gameManager.gameData ? (
		<>
			<h1 className="HostView-Title">Time to recruit.</h1>
			<div className="HostView-LinkAndCodeContainer">
				<ol className="HostView-LinkAndCodeContainerList">
					<li className="HostView-LinkAndCodeContainerListItem">
						Visit <span className="HostView-Link">{`${DOMAIN_BASE}/escape/join`}</span>
					</li>
					<li className="HostView-LinkAndCodeContainerListItem">
						Enter the code <span className="HostView-Code">{gameManager.code}</span>
					</li>
				</ol>
			</div>
			<ul className="HostView-PlayersContainer">
				{Object.values(gameManager.gameData.players).map((player) => (
					<li className="HostView-Player" key={player.id}>
						<div className="HostView-PlayerName">{player.name}</div>
					</li>
				))}
			</ul>
		</>
	) : (
		<h1 className="HostView-Title">Loading…</h1>
	);
}
