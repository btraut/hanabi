import * as React from 'react';
import { connect } from 'react-redux';
import * as JSONPretty from 'react-json-pretty';

import { StoreData } from '../reducers/root';
import { GameState, GameData } from '../models/Game';
import { MINIMUM_PLAYERS_IN_GAME } from '../models/Rules';
import { ClientGameManagerPropsAdditions } from './ClientGameManager';

type ExternalPlayerViewProps = React.Props<PlayerViewPage> & ClientGameManagerPropsAdditions;
type PlayerViewProps = {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly userId: string | null;
	readonly gameData: GameData | null;
	readonly joinGameError: string | null;
	readonly startGameError: string | null;
	readonly setPlayerNameError: string | null;
	readonly setPlayerPictureError: string | null;
	readonly enterPhraseError: string | null;
	readonly enterPictureError: string | null;
} & ExternalPlayerViewProps;

class PlayerViewPage extends React.PureComponent<PlayerViewProps> {
	private _joinGameInput: HTMLInputElement | null = null;
	private _enterNameInput: HTMLInputElement | null = null;
	private _enterPhraseInput: HTMLInputElement | null = null;
	
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
	
	private _handleJoinGameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		const { clientGameManager } = this.props;
		
		event.preventDefault();
		
		if (this._joinGameInput) {
			clientGameManager.joinGame(this._joinGameInput.value);
		}
	}
	
	private _renderInGameLobby(gameData: GameData) {
		const { startGameError } = this.props;
		
		return (
			<div>
				<h1>In Game Lobby…</h1>
				{
					gameData.players.length >= MINIMUM_PLAYERS_IN_GAME &&
						<button onClick={this._handleStartGameButtonClick}>Start Game</button>
				}
				{ startGameError && <p style={{ color: 'red' }}>{ startGameError }</p>}
			</div>
		);
	}
	
	private _renderWaitingForPlayerDescriptions(gameData: GameData, userId: string | null) {
		const player = gameData.players.find(p => p.id === userId);
		
		if (!player) {
			throw new Error('Can’t find your user in the game.');
		}
		
		if (!player.name) {
			return this._renderEnterUserName();
		}
		
		if (!player.pictureData) {
			return this._renderDrawUserPicture();
		}
		
		return this._renderWaitingForOtherPlayerDescriptions();
	}
	
	private _renderWaitingForPhraseSubmissions(gameData: GameData, userId: string | null) {
		const phrases = gameData.phrases[gameData.currentRound - 1] || {};
		
		if (!userId || !phrases[userId]) {
			return this._renderEnterPhrase();
		}
		
		return this._renderWaitingForOtherPlayersToSubmitPhrases();
	}
	
	private _renderEnterPhrase() {
		const { enterPhraseError } = this.props;
		
		return (
			<form onSubmit={this._handleEnterPhraseSubmit}>
				<h1>Enter a phrase!</h1>
				<p>
					<input type="text" ref={(input: HTMLInputElement | null) => { this._enterPhraseInput = input; }} />
					<input type="submit" value="Submit" />
					{ enterPhraseError && <p style={{ color: 'red' }}>{ enterPhraseError }</p>}
				</p>
			</form>
		);
	}
	
	private _handleEnterPhraseSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		event.preventDefault();
		
		if (this._enterPhraseInput) {
			clientGameManager.enterPhrase(gameData.code, gameData.currentRound, this._enterPhraseInput.value);
		}
	}

	private _renderWaitingForOtherPlayersToSubmitPhrases() {
		return (
			<div>
				<h1>Waiting for other players to submit phrase…</h1>
			</div>
		);
	}
	
	private _renderEnterUserName() {
		const { setPlayerNameError } = this.props;
		
		return (
			<form onSubmit={this._handleEnterUserNameSubmit}>
				<h1>You need to enter your name!</h1>
				<p>
					<input type="text" ref={(input: HTMLInputElement | null) => { this._enterNameInput = input; }} />
					<input type="submit" value="Join" />
					{ setPlayerNameError && <p style={{ color: 'red' }}>{ setPlayerNameError }</p>}
				</p>
			</form>
		);
	}
	
	private _handleEnterUserNameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		event.preventDefault();
		
		if (this._enterNameInput) {
			clientGameManager.setPlayerName(gameData.code, this._enterNameInput.value);
		}
	}
	
	private _renderDrawUserPicture() {
		const { setPlayerPictureError } = this.props;
		
		return (
			<div>
				<h1>You need to draw your picture!</h1>
				<p>
					<button onClick={this._handleDrawUserPictureSubmit}>Submit Picture</button>
					{ setPlayerPictureError && <p style={{ color: 'red' }}>{ setPlayerPictureError }</p>}
				</p>
			</div>
		);
	}
	
	private _handleDrawUserPictureSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		event.preventDefault();
		
		clientGameManager.setPlayerPicture(gameData.code, ':)');
	}
	
	private _renderWaitingForOtherPlayerDescriptions() {
		return <h1>Waiting for other players to name and draw themselves…</h1>;
	}
	
	private _handleStartGameButtonClick = () => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		clientGameManager.startGame(gameData.code);
	}
	
	private _renderGameState(gameData: GameData, userId: string | null) {
		switch (gameData.state) {
		case GameState.WaitingForPlayers: return this._renderInGameLobby(gameData);
		case GameState.WaitingForPlayerDescriptions: return this._renderWaitingForPlayerDescriptions(gameData, userId);
		case GameState.WaitingForPhraseSubmissions: return this._renderWaitingForPhraseSubmissions(gameData, userId);
			
		case GameState.WaitingForPictureSubmissions:
			// TODO: Look at game data to determine if we've already submitted a picture.
			return <div>Waiting for others to draw a picture…</div>;
			
		case GameState.ReviewingStories: return <div>Reviewing sequences…</div>;
	
		case GameState.PlayAgainOptions: return <div>Play again?</div>;
		}
	}
	
	public render() {
		const { connected, gameData, userId } = this.props;
		
		if (!connected) {
			return <div>Connecting…</div>;
		}
		
		if (!gameData) {
			return this._renderJoinGame();
		}
		
		return (
			<div className="PlayerView">
				{ this._renderGameState(gameData, userId) }
				<JSONPretty json={gameData} />
			</div>
		);
	}
};

export default connect(({ game: {
	initialDataLoaded, connected, userId, gameData, joinGameError, startGameError,
	setPlayerNameError, setPlayerPictureError, enterPhraseError, enterPictureError
} }: StoreData) => ({
	initialDataLoaded, connected, userId, gameData, joinGameError, startGameError,
	setPlayerNameError, setPlayerPictureError, enterPhraseError, enterPictureError
}))(PlayerViewPage) as any as React.ComponentClass<ExternalPlayerViewProps>;
