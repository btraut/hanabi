import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import * as JSONPretty from 'react-json-pretty';
import { withRouter, RouteComponentProps } from 'react-router';

import { StoreData } from '../reducers/root';
import { GameState, GameData } from '../models/Game';
import { MINIMUM_PLAYERS_IN_GAME } from '../models/Rules';
import { ClientGameManagerPropsAdditions } from './ClientGameManager';
import Canvas from './Canvas';

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
	readonly startOverError: string | null;
	readonly endGameError: string | null;
} & ExternalPlayerViewProps & RouteComponentProps<any>;

class PlayerViewPage extends React.PureComponent<PlayerViewProps> {
	private _joinGameInput: HTMLInputElement | null = null;
	private _enterNameInput: HTMLInputElement | null = null;
	private _enterPhraseInput: HTMLInputElement | null = null;
	
	private _drawUserPictureCanvas: Canvas | null = null;
	private _drawPictureCanvas: Canvas | null = null;
	
	public componentDidMount() {
		const { clientGameManager } = this.props;
		clientGameManager.connect();
	}
	
	public componentWillUnmount() {
		const { clientGameManager } = this.props;
		clientGameManager.disconnect();
	}
	
	public componentWillReceiveProps(newProps: PlayerViewProps) {
		const { gameData, history } = this.props;
		
		// If the user has switched to reviewing stories, set a timer to
		// finish the game.
		if (gameData && !newProps.gameData) {
			history.push('/');
		}
	}
	
	private _renderJoinGame() {
		const { joinGameError } = this.props;
		
		return (
			<form onSubmit={this._handleJoinGameSubmit}>
				<h1>Join Game:</h1>
				<div>
					<input type="text" ref={(input: HTMLInputElement | null) => { this._joinGameInput = input; }} />
					<input type="submit" value="Join" />
				</div>
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
	
	private _renderInGameLobby() {
		const { startGameError, gameData } = this.props;
		
		return (
			<div>
				<h1>In Game Lobby…</h1>
				{
					gameData!.players.length >= MINIMUM_PLAYERS_IN_GAME &&
						<button onClick={this._handleStartGameButtonClick}>Start Game</button>
				}
				{ startGameError && <p style={{ color: 'red' }}>{ startGameError }</p>}
			</div>
		);
	}
	
	private _handleStartGameButtonClick = () => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		clientGameManager.startGame(gameData.code);
	}
	
	private _renderEnterUserName() {
		const { setPlayerNameError } = this.props;
		
		return (
			<form onSubmit={this._handleEnterUserNameSubmit}>
				<h1>Enter your name:</h1>
				<div>
					<input type="text" ref={(input: HTMLInputElement | null) => { this._enterNameInput = input; }} />
					<input type="submit" value="Join" />
					{ setPlayerNameError && <p style={{ color: 'red' }}>{ setPlayerNameError }</p>}
				</div>
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
				<h1>Draw a picture of yourself:</h1>
				<div>
					<Canvas ref={(ele: Canvas | null) => { this._drawUserPictureCanvas = ele; }} style={{ height: 500 }} />
					<button onClick={this._handleDrawUserPictureSubmit}>Submit Picture</button>
					{ setPlayerPictureError && <p style={{ color: 'red' }}>{ setPlayerPictureError }</p>}
				</div>
			</div>
		);
	}
	
	private _handleDrawUserPictureSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData || !this._drawUserPictureCanvas) {
			return;
		}
		
		const pictureData = this._drawUserPictureCanvas.getData();
		if (!pictureData) {
			return;
		}
		
		clientGameManager.setPlayerPicture(gameData.code, pictureData);
	}
	
	private _renderWaitingForOtherPlayerDescriptions() {
		return <h1>Waiting for other players to name and draw themselves…</h1>;
	}
	
	private _renderWaitingForPlayerDescriptions() {
		const { gameData, userId } = this.props;
		
		const player = gameData!.players.find(p => p.id === userId);
		
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
	
	private _renderWaitingForPhraseSubmissions() {
		const { gameData, userId } = this.props;
		
		const index = gameData!.currentRound / 2;
		const phrases = gameData!.phrases[index] || {};
		
		if (!userId || !phrases[userId]) {
			return this._renderEnterPhrase();
		}
		
		return this._renderWaitingForOtherPlayersToSubmitPhrases();
	}
	
	private _renderEnterPhrase() {
		const { enterPhraseError, gameData, userId } = this.props;
		
		if (!gameData) {
			return null;
		}
		
		let header = 'Enter a starting phrase:';
		let pictureData = null;
		
		if (gameData.currentRound !== 0) {
			const playerOrder = gameData.players.find(p => p.id === userId)!.order!;
			const nextOrder = playerOrder === gameData.players.length - 1 ? 0 : playerOrder + 1;
			const nextPlayerId = gameData.players.find(p => p.order === nextOrder)!.id;
			const pictureIndex = (gameData.currentRound - 2) / 2;
			
			header = 'Describe this picture:';
			pictureData = gameData.pictures[pictureIndex][nextPlayerId];
		}
		
		return (
			<form onSubmit={this._handleEnterPhraseSubmit}>
				<h1>{ header }</h1>
				{ pictureData && <img src={pictureData} /> }
				<div>
					<input type="text" ref={(input: HTMLInputElement | null) => { this._enterPhraseInput = input; }} />
					<input type="submit" value="Submit" />
					{ enterPhraseError && <p style={{ color: 'red' }}>{ enterPhraseError }</p>}
				</div>
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
	
	private _renderWaitingForPictureSubmissions() {
		const { gameData, userId } = this.props;

		const index = (gameData!.currentRound - 1) / 2;
		const pictures = gameData!.pictures[index] || {};
		
		if (!userId || !pictures[userId]) {
			return this._renderDrawPicture();
		}
		
		return this._renderWaitingForOtherPlayersToSubmitPictures();
	}
	
	private _renderDrawPicture() {
		const { enterPictureError, gameData, userId } = this.props;
		
		if (!gameData) {
			return null;
		}
		
		const playerOrder = gameData.players.find(p => p.id === userId)!.order!;
		const nextOrder = playerOrder === gameData.players.length - 1 ? 0 : playerOrder + 1;
		const nextPlayerId = gameData.players.find(p => p.order === nextOrder)!.id;
		const phraseIndex = (gameData.currentRound - 1) / 2;
		const previousPhrase = gameData.phrases[phraseIndex][nextPlayerId];
		
		return (
			<div>
				<h1>Draw a picture that represents:</h1>
				<h1>{ previousPhrase }</h1>
				<div>
					<Canvas ref={(ele: Canvas | null) => { this._drawPictureCanvas = ele; }} style={{ height: 500 }} />
					<button onClick={this._handleDrawPictureSubmit}>Submit Picture</button>
					{ enterPictureError && <p style={{ color: 'red' }}>{ enterPictureError }</p>}
				</div>
			</div>
		);
	}
	
	private _handleDrawPictureSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData || !this._drawPictureCanvas) {
			return;
		}
		
		const pictureData = this._drawPictureCanvas.getData();
		if (!pictureData) {
			return;
		}
		
		clientGameManager.enterPicture(gameData.code, gameData.currentRound, pictureData);
	}
	
	private _renderWaitingForOtherPlayersToSubmitPictures() {
		return (
			<div>
				<h1>Waiting for other players to submit pictures…</h1>
			</div>
		);
	}
	
	private _renderReviewingStories() {
		return <h1>Reviewing sequences…</h1>;
	}
	
	private _renderPlayAgainOptions() {
		const { startOverError, endGameError } = this.props;
		
		return (
			<div>
				<h1>Game Over</h1>
				<div>
					<button onClick={this._handlePlayAgainClick}>Play Again</button>
					<button onClick={this._handleEndGameClick}>End Game</button>
					{ startOverError && <p style={{ color: 'red' }}>{ startOverError }</p>}
					{ endGameError && <p style={{ color: 'red' }}>{ endGameError }</p>}
				</div>
			</div>
		);
	}
	
	private _handlePlayAgainClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		event.preventDefault();
		
		clientGameManager.startOver(gameData.code);
	}
	
	private _handleEndGameClick = (event: React.MouseEvent<HTMLButtonElement>) => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		event.preventDefault();
		
		clientGameManager.endGame(gameData.code);
	}
	
	private _renderGameState() {
		const { gameData } = this.props;
		
		switch (gameData!.state) {
		case GameState.WaitingForPlayers: return this._renderInGameLobby();
		case GameState.WaitingForPlayerDescriptions: return this._renderWaitingForPlayerDescriptions();
		case GameState.WaitingForPhraseSubmissions: return this._renderWaitingForPhraseSubmissions();
		case GameState.WaitingForPictureSubmissions: return this._renderWaitingForPictureSubmissions();
		case GameState.ReviewingStories: return this._renderReviewingStories();
		case GameState.PlayAgainOptions: return this._renderPlayAgainOptions();
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
				{ this._renderGameState() }
				<JSONPretty json={gameData} />
			</div>
		);
	}
};

export default (compose(
	connect(({ game: {
		initialDataLoaded, connected, userId, gameData, joinGameError, startGameError,
		setPlayerNameError, setPlayerPictureError, enterPhraseError, enterPictureError,
		startOverError, endGameError
	} }: StoreData) => ({
		initialDataLoaded, connected, userId, gameData, joinGameError, startGameError,
		setPlayerNameError, setPlayerPictureError, enterPhraseError, enterPictureError,
		startOverError, endGameError
	})) as any,
	withRouter as any
) as any)(PlayerViewPage) as any as React.ComponentClass<ExternalPlayerViewProps>;
