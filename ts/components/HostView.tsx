import * as React from 'react';
import { connect } from 'react-redux';
import * as JSONPretty from 'react-json-pretty';

import { StoreData } from '../reducers/root';
import { GameState, GameData } from '../models/Game';
import { ClientGameManagerPropsAdditions } from './ClientGameManager';

type ExternalHostViewProps = React.Props<HostViewPage> & ClientGameManagerPropsAdditions;
type HostViewProps = {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
} & ExternalHostViewProps;

class HostViewPage extends React.PureComponent<HostViewProps> {
	public componentDidMount() {
		this._connect();
	}
	
	public componentDidUpdate() {
		this._connect();
	}
	
	private _connect() {
		const { clientGameManager, initialDataLoaded, connected, gameData } = this.props;
		
		if (connected) {
			if (initialDataLoaded && !gameData) {
				clientGameManager.createGame();
			}
		} else {
			clientGameManager.connect();
		}
	}
	
	public componentWillUnmount() {
		const { clientGameManager } = this.props;
		clientGameManager.disconnect();
	}
	
	private _renderWaitingForPlayers(gameData: GameData) {
		return (
			<div>
				<h1>Your game has been created!</h1>
				<p>Players can join the game using the code <strong>{ gameData.code }</strong>.</p>
				<ul>
					{ gameData.players.map(player => (
						<li key={player.id}>
							{ player.id }: { player.name || 'anonymous player' }, { player.connected ? 'connected' : 'disconnected' }
						</li>
					)) }
				</ul>
			</div>
		);
	}
	
	private _renderGameState(gameData: GameData) {
		switch (gameData.state) {
		case GameState.WaitingForPlayers: return this._renderWaitingForPlayers(gameData);
		case GameState.WaitingForPlayerDescriptions: return <div>Players are naming themselves…</div>;
		case GameState.WaitingForTextSubmissions: return <div>Players are submitting text…</div>;
		case GameState.WaitingForPictureSubmissions: return <div>Players are submitting drawings…</div>;
		case GameState.ReviewingStories: return <div>Reviewing sequences…</div>;
		case GameState.PlayAgainOptions: return <div>Play again?</div>;
		}
	}
	
	public render() {
		const { connected, gameData, initialDataLoaded } = this.props;
		
		if (!connected) {
			return <div>Connecting…</div>;
		}
		
		if (!initialDataLoaded || !gameData) {
			return <div>Loading…</div>;
		}
		
		return (
			<div className="PlayerView">
				{ this._renderGameState(gameData) }
				<JSONPretty json={gameData} />
			</div>
		);
	}
};

export default connect(({ game: { initialDataLoaded, connected, gameData } }: StoreData) => ({
	initialDataLoaded, connected, gameData
}))(HostViewPage) as any as React.ComponentClass<ExternalHostViewProps>;
