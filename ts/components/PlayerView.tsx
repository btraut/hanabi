import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import * as JSONPretty from 'react-json-pretty';

import { StoreData } from '../reducers/root';
import { GameState, GameData } from '../models/Game';
import withClientGameManager, { ClientGameManagerProviderPropsAdditions } from './withClientGameManager';

type ExternalPlayerViewProps = React.Props<PlayerViewPage>;
type PlayerViewProps = {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
	readonly joinGameError: string | null;
} & ExternalPlayerViewProps & ClientGameManagerProviderPropsAdditions;

class PlayerViewPage extends React.PureComponent<PlayerViewProps> {
	private _joinGameInput: HTMLInputElement | null = null;
	
	public componentDidMount() {
		const { clientGameManager } = this.props;
		clientGameManager.connect();
	}
	
	public componentWillUnmount() {
		const { clientGameManager } = this.props;
		clientGameManager.disconnect();
	}
	
	private _renderJoinGame() {
		const { joinGameError } = this.props;
		
		return (
			<form onSubmit={this._handleJoinGameSubmit}>
				<h1>Join Game:</h1>
				<p>
					<input type="text" ref={(input: HTMLInputElement | null) => { this._joinGameInput = input; }} />
					<input type="submit" value="Join" />
				</p>
				{ joinGameError && <p style={{ color: 'red' }}>{ joinGameError }</p>}
			</form>
		);
	}
	
	private _renderInGameLobby(gameState: GameState) {
		return <div>In Game Lobby…</div>
	}
	
	private _handleJoinGameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		const { clientGameManager } = this.props;
		
		event.preventDefault();
		
		if (this._joinGameInput) {
			clientGameManager.joinGame(this._joinGameInput.value);
		}
	}
	
	private _renderGameState(gameData: GameData) {
		switch (gameData.state) {
		case GameState.WaitingForPlayers: return this._renderInGameLobby(GameState);
		
		case GameState.WaitingForPlayerDescriptions:
			// TODO: Look at data to determine if we need to enter name, draw
			// picture, or neither.
			return <div>Waiting for game to begin…</div>;
			
		case GameState.WaitingForTextSubmissions:
			// TODO: Look at game data to determine if we've already submitted text.
			return <div>Waiting for others to enter text…</div>;
			
		case GameState.WaitingForPictureSubmissions:
			// TODO: Look at game data to determine if we've already submitted a picture.
			return <div>Waiting for others to draw a picture…</div>;
			
		case GameState.ReviewingStories: return <div>Reviewing sequences…</div>;
	
		case GameState.PlayAgainOptions: return <div>Play again?</div>;
		}
	}
	
	public render() {
		const { connected, gameData } = this.props;
		
		if (!connected) {
			return <div>Connecting…</div>;
		}
		
		if (!gameData) {
			return this._renderJoinGame();
		}
		
		return (
			<div className="PlayerView">
				{ this._renderGameState(gameData) }
				<JSONPretty json={gameData} />
			</div>
		);
	}
};

export default compose(
	withClientGameManager,
	connect(({ game: { initialDataLoaded, connected, gameData, joinGameError } }: StoreData) => ({
		initialDataLoaded, connected, gameData, joinGameError
	}))
)(PlayerViewPage) as any as React.ComponentClass<ExternalPlayerViewProps>;
