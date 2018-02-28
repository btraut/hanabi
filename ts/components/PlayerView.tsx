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

type ExternalPlayerViewProps = {
	readonly showGameState?: boolean;
} & React.Props<PlayerViewPage> & ClientGameManagerPropsAdditions;
type PlayerViewProps = {
	readonly showGameState: boolean;
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

interface PlayerViewState {
	drawPlayerPictureCanvasSize?: { width: number; height: number; };
	drawPictureCanvasSize?: { width: number; height: number; };
}

class PlayerViewPage extends React.PureComponent<PlayerViewProps, PlayerViewState> {
	public static defaultProps: Partial<PlayerViewProps> = {
		showGameState: false
	};
	
	public state: PlayerViewState = {};
	
	private _joinGameCodeInput: HTMLInputElement | null = null;
	private _joinGameNameInput: HTMLInputElement | null = null;
	private _enterPhraseInput: HTMLInputElement | null = null;
	
	private _drawPlayerPictureCanvas: Canvas | null = null;
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
			<form className="PlayerView-GameForm" onSubmit={this._handleJoinGameSubmit}>
				<h1 className="PlayerView-Title">Let’s begin.</h1>
				{ joinGameError && <p className="PlayerView-ErrorText">{ joinGameError }</p>}
				<div className="PlayerView-GameFormContainer">
					<label className="PlayerView-TextEntryLabel" htmlFor="PlayerView-Code">Code:</label>
					<input
						className="PlayerView-TextEntryInput"
						id="PlayerView-Code"
						type="text"
						ref={(input: HTMLInputElement | null) => { this._joinGameCodeInput = input; }}
						autoCorrect="off"
						autoCapitalize="none"
					/>
					<label className="PlayerView-TextEntryLabel" htmlFor="PlayerView-Name">Name:</label>
					<input
						className="PlayerView-TextEntryInput"
						id="PlayerView-Name"
						type="text"
						ref={(input: HTMLInputElement | null) => { this._joinGameNameInput = input; }}
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="PlayerView-GameFormButtons">
					<input className="PlayerView-SubmitButton" type="submit" value="Join" />
				</div>
			</form>
		);
	}
	
	private _handleJoinGameSubmit = (event: React.FormEvent<HTMLFormElement>) => {
		const { clientGameManager } = this.props;
		
		event.preventDefault();
		
		if (this._joinGameCodeInput && this._joinGameNameInput) {
			clientGameManager.joinGame(this._joinGameCodeInput.value, this._joinGameNameInput.value);
		}
	}
	
	private _renderInGameLobby() {
		const { gameData, userId } = this.props;
		
		const player = gameData!.players.find(p => p.id === userId);
		
		if (!player) {
			throw new Error('Can’t find your user in the game.');
		}
		
		if (!player.pictureData) {
			return this._renderDrawPlayerPicture();
		}
		
		const playersStillDrawing = gameData!.players.find(p => !p.pictureData);
		if (playersStillDrawing || gameData!.players.length < MINIMUM_PLAYERS_IN_GAME) {
			return this._renderWaitingForOtherPlayers();
		}

		return this._renderWaitingForStart();
	}
	
	private _renderDrawPlayerPicture() {
		const { setPlayerPictureError } = this.props;
		const { drawPlayerPictureCanvasSize } = this.state;
		
		return (
			<>
				<h1 className="PlayerView-Title">Draw yourself.</h1>
				<div className="PlayerView-CanvasContainer" ref={this._setDrawPlayerPictureCanvasSize}>
					{ drawPlayerPictureCanvasSize && <Canvas
						ref={(ele: Canvas | null) => { this._drawPlayerPictureCanvas = ele; }}
						style={{ ...drawPlayerPictureCanvasSize }}
					/> }
				</div>
				{ setPlayerPictureError && <p className="PlayerView-ErrorText">{ setPlayerPictureError }</p>}
				<button className="PlayerView-SubmitButton" onClick={this._handleDrawPlayerPictureSubmit}>Submit</button>
			</>
		);
	}
	
	private _setDrawPlayerPictureCanvasSize = (ref: HTMLDivElement | null) => {
		const { drawPlayerPictureCanvasSize } = this.state;
		
		if (ref && !drawPlayerPictureCanvasSize) {
			this.setState({ drawPlayerPictureCanvasSize: {
				width: ref.offsetWidth,
				height: ref.offsetHeight
			}});
		} else if (!ref && drawPlayerPictureCanvasSize) {
			this.setState({ drawPlayerPictureCanvasSize: undefined });
		}
	}
	
	private _handleDrawPlayerPictureSubmit = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData || !this._drawPlayerPictureCanvas) {
			return;
		}
		
		const pictureData = this._drawPlayerPictureCanvas.getData();
		if (!pictureData) {
			return;
		}
		
		clientGameManager.setPlayerPicture(gameData.code, pictureData);
	}
	
	private _renderWaitingForOtherPlayers() {
		return (
			<>
				<h1 className="PlayerView-Title">Waiting for others…</h1>
				<p className="PlayerView-BodyText">You can start when everyone has finished drawing themselves.</p>
			</>
		);
	}
	
	private _renderWaitingForStart() {
		const { startGameError } = this.props;

		return (
			<>
				<h1 className="PlayerView-Title">Waiting for others…</h1>
				{ startGameError && <p className="PlayerView-ErrorText">{ startGameError }</p>}
				<button className="PlayerView-SubmitButton" onClick={this._handleStartGameButtonClick}>Everyone’s ready</button>
			</>
		);
	}
	
	private _handleStartGameButtonClick = () => {
		const { clientGameManager, gameData } = this.props;
		
		if (!gameData) {
			return;
		}
		
		clientGameManager.startGame(gameData.code);
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
		
		let header = 'Enter a phrase.';
		let pictureData = null;
		
		if (gameData.currentRound !== 0) {
			const playerOrder = gameData.players.find(p => p.id === userId)!.order!;
			const nextOrder = playerOrder === gameData.players.length - 1 ? 0 : playerOrder + 1;
			const nextPlayerId = gameData.players.find(p => p.order === nextOrder)!.id;
			const pictureIndex = (gameData.currentRound - 2) / 2;
			
			header = 'What is this?';
			pictureData = gameData.pictures[pictureIndex][nextPlayerId];
		}
		
		return (
			<form className="PlayerView-GameForm" onSubmit={this._handleEnterPhraseSubmit}>
				<h1 className="PlayerView-Title">{ header }</h1>
				{ pictureData && <img className="PlayerView-Picture" src={pictureData} /> }
				{ enterPhraseError && <p className="PlayerView-ErrorText">{ enterPhraseError }</p>}
				<div className="PlayerView-GameFormContainer">
					<label className="PlayerView-TextEntryLabel" htmlFor="PlayerView-Phrase">Phrase:</label>
					<input
						className="PlayerView-TextEntryInput"
						id="PlayerView-Phrase"
						type="text"
						ref={(input: HTMLInputElement | null) => { this._enterPhraseInput = input; }}
						autoCorrect="off"
						autoCapitalize="none"
					/>
				</div>
				<div className="PlayerView-GameFormButtons">
					<input className="PlayerView-SubmitButton" type="submit" value="Submit" />
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
			<>
				<h1 className="PlayerView-Title">Waiting for others…</h1>
				<p className="PlayerView-BodyText">You’ll move on when everyone has finished typing a phrase.</p>
			</>
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
		const { drawPictureCanvasSize } = this.state;
		
		if (!gameData) {
			return null;
		}
		
		const playerOrder = gameData.players.find(p => p.id === userId)!.order!;
		const nextOrder = playerOrder === gameData.players.length - 1 ? 0 : playerOrder + 1;
		const nextPlayerId = gameData.players.find(p => p.order === nextOrder)!.id;
		const phraseIndex = (gameData.currentRound - 1) / 2;
		const previousPhrase = gameData.phrases[phraseIndex][nextPlayerId];
		
		return (
			<>
				<h1 className="PlayerView-Title">Let’s draw.</h1>
				<p className="PlayerView-Description">Draw a picture that represents this phrase:</p>
				<p className="PlayerView-Description">{ previousPhrase }</p>
				<div className="PlayerView-CanvasContainer" ref={this._setDrawPictureCanvasSize}>
					{ drawPictureCanvasSize && <Canvas
						ref={(ele: Canvas | null) => { this._drawPictureCanvas = ele; }}
						style={{ ...drawPictureCanvasSize }}
					/> }
				</div>
				{ enterPictureError && <p className="PlayerView-ErrorText">{ enterPictureError }</p>}
				<button className="PlayerView-SubmitButton" onClick={this._handleDrawPictureSubmit}>Submit</button>
			</>
		);
	}
	
	private _setDrawPictureCanvasSize = (ref: HTMLDivElement | null) => {
		const { drawPictureCanvasSize } = this.state;
		
		if (ref && !drawPictureCanvasSize) {
			this.setState({ drawPictureCanvasSize: {
				width: ref.offsetWidth,
				height: ref.offsetHeight
			}});
		} else if (!ref && drawPictureCanvasSize) {
			this.setState({ drawPictureCanvasSize: undefined });
		}
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
			<>
				<h1 className="PlayerView-Title">Waiting for others…</h1>
				<p className="PlayerView-BodyText">You’ll move on when everyone has finished drawing a picture.</p>
			</>
		);
	}
	
	private _renderReviewingStories() {
		return (
			<>
				<h1 className="PlayerView-Title">Let's review.</h1>
				<p className="PlayerView-BodyText">Watch all the words and art on the main screen.</p>
			</>
		);
	}
	
	private _renderPlayAgainOptions() {
		const { startOverError, endGameError } = this.props;
		
		return (
			<>
				<h1 className="PlayerView-Title">Game over.</h1>
				{ startOverError && <p className="PlayerView-ErrorText">{ startOverError }</p>}
				{ endGameError && <p className="PlayerView-ErrorText">{ endGameError }</p>}
				<div className="PlayerView-GameActions">
					<button className="PlayerView-SubmitButton" onClick={this._handlePlayAgainClick}>Play Again</button>
					<button className="PlayerView-SubmitButton" onClick={this._handleEndGameClick}>End Game</button>
				</div>
			</>
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
		case GameState.WaitingForPhraseSubmissions: return this._renderWaitingForPhraseSubmissions();
		case GameState.WaitingForPictureSubmissions: return this._renderWaitingForPictureSubmissions();
		case GameState.ReviewingStories: return this._renderReviewingStories();
		case GameState.PlayAgainOptions: return this._renderPlayAgainOptions();
		}
		
		return null;
	}
	
	public render() {
		const { connected, gameData, showGameState } = this.props;
		
		if (!connected) {
			return <div>Connecting…</div>;
		}
		
		let viewContent: React.ReactElement<any> | null = null;
		
		if (gameData) {
			viewContent = (
				<>
					{ this._renderGameState() }
					{ showGameState && <JSONPretty json={gameData} /> }
				</>
			);
		} else {
			viewContent = this._renderJoinGame();
		}
		
		return (
			<div className="PlayerView">
				{ viewContent }
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
