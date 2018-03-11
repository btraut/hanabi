import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import * as JSONPretty from 'react-json-pretty';
import { withRouter, RouteComponentProps } from 'react-router';

import { StoreData } from '../reducers/root';
import { GameState, GameData, ConnectionState } from '../models/Game';
import { ClientGameManagerPropsAdditions } from './ClientGameManager';

// Define globals from webpack.
declare const DOMAIN_BASE: string;

type ExternalHostViewProps = {
	readonly showGameState?: boolean;
} & React.Props<HostViewPage> & ClientGameManagerPropsAdditions;
type HostViewProps = {
	readonly showGameState: boolean;
	readonly connectionState: ConnectionState;
	readonly gameData: GameData | null;
} & ExternalHostViewProps & RouteComponentProps<any>;

class HostViewPage extends React.PureComponent<HostViewProps> {
	public static defaultProps: Partial<HostViewProps> = {
		showGameState: false
	};
	
	public componentDidMount() {
		this._connect();
	}
	
	public componentDidUpdate() {
		this._connect();
	}
	
	private _connect() {
		const { clientGameManager, connectionState, gameData } = this.props;
		
		if (connectionState === ConnectionState.Connected) {
			if (!gameData) {
				clientGameManager.createGame();
			}
		} else if (connectionState === ConnectionState.Disconnected) {
			clientGameManager.connect();
		}
	}
	
	public componentWillUnmount() {
		const { clientGameManager } = this.props;
		clientGameManager.disconnect();
	}
	
	public componentWillReceiveProps(newProps: HostViewProps) {
		const { gameData, clientGameManager, history } = this.props;
		
		// If the user has switched to reviewing stories, set a timer to
		// finish the game.
		if (gameData && !newProps.gameData) {
			history.push('/');
		}
		
		// If the user has switched to reviewing stories, set a timer to
		// finish the game.
		if (
			newProps.gameData && newProps.gameData.state === GameState.ReviewingStories &&
			gameData && gameData.state !== GameState.ReviewingStories
		) {
			setTimeout(() => {
				clientGameManager.finishReviewing(gameData.code);
			}, 5000);
			return;
		}
	}
	
	private _renderWaitingForPlayers(gameData: GameData) {
		return (
			<>
				<h1 className="HostView-Title">Time to recruit.</h1>
				<div className="HostView-LinkAndCodeContainer">
					<ol className="HostView-LinkAndCodeContainerList">
						<li className="HostView-LinkAndCodeContainerListItem">Visit <span className="HostView-Link">{ `${ DOMAIN_BASE }/join` }</span></li>
						<li className="HostView-LinkAndCodeContainerListItem">Enter the code <span className="HostView-Code">{ gameData.code }</span></li>
					</ol>
				</div>
				<ul className="HostView-LobbyPlayersContainer">
					{ gameData.players.map(player => (
						<li className="HostView-LobbyPlayer" key={player.id}>
							{ player.pictureData && <img className="HostView-LobbyPlayerPicture" src={player.pictureData} /> }
							{ !player.pictureData && <img className="HostView-LobbyPlayerPicture" src="/images/drawing-face.svg" /> }
							<div className="HostView-LobbyPlayerName">{ player.name }</div>
						</li>
					)) }
				</ul>
			</>
		);
	}
	
	private _renderGameState(gameData: GameData) {
		switch (gameData.state) {
		case GameState.WaitingForPlayers: return this._renderWaitingForPlayers(gameData);
		case GameState.WaitingForPhraseSubmissions: return <div>Players are submitting phrases…</div>;
		case GameState.WaitingForPictureSubmissions: return <div>Players are submitting drawings…</div>;
		case GameState.ReviewingStories: return <div>Reviewing sequences…</div>;
		case GameState.PlayAgainOptions: return <div>Play again?</div>;
		}
	}
	
	public render() {
		const { connectionState, gameData, showGameState } = this.props;
		
		if (connectionState !== ConnectionState.Connected) {
			return <div>Connecting…</div>;
		}
		
		if (!gameData) {
			return <div>Loading…</div>;
		}
		
		return (
			<div className="HostView">
				{ this._renderGameState(gameData) }
				{ showGameState && <JSONPretty json={gameData} /> }
			</div>
		);
	}
}

export default (compose(
	connect(({ connectionState, gameData }: StoreData) => ({
		connectionState, gameData
	})) as any,
	withRouter as any
) as any)(HostViewPage) as any as React.ComponentClass<ExternalHostViewProps>;
