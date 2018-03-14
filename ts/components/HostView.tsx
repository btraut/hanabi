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
		const { gameData, history } = this.props;
		
		// If the user has switched to reviewing stories, set a timer to
		// finish the game.
		if (gameData && !newProps.gameData) {
			history.push('/');
		}
	}
	
	private _renderWaitingForPlayers() {
		const { gameData } = this.props;
		
		if (!gameData) {
			return null;
		}
		
		return (
			<>
				<h1 className="HostView-Title">Time to recruit.</h1>
				<div className="HostView-LinkAndCodeContainer">
					<ol className="HostView-LinkAndCodeContainerList">
						<li className="HostView-LinkAndCodeContainerListItem">Visit <span className="HostView-Link">{ `${ DOMAIN_BASE }/join` }</span></li>
						<li className="HostView-LinkAndCodeContainerListItem">Enter the code <span className="HostView-Code">{ gameData.code }</span></li>
					</ol>
				</div>
				<ul className="HostView-PlayersContainer">
					{ gameData.players.map(player => (
						<li className="HostView-Player" key={player.id}>
							{ player.pictureData && <img className="HostView-PlayerPicture" src={player.pictureData} /> }
							{ !player.pictureData && <img className="HostView-PlayerPicture" src="/images/drawing-face.svg" /> }
							<div className="HostView-PlayerName">{ player.name }</div>
						</li>
					)) }
				</ul>
			</>
		);
	}
	
	private _renderWaitingForPhraseSubmissions() {
		const { gameData } = this.props;
		
		if (!gameData) {
			return null;
		}
		
		const currentRoundIndex = gameData.currentRound / 2;
		
		return (
			<>
				<h1 className="HostView-Title">It’s time for words.</h1>
				<p className="HostView-BodyText">Players are entering phrases.</p>
				<ul className="HostView-PlayersContainer">
					{ gameData.players.map(player => {
						const playerSubmitPhrase = gameData.phrases[currentRoundIndex] && player.id in gameData.phrases[currentRoundIndex];
						
						return (
							<li className="HostView-Player" key={player.id}>
								{ playerSubmitPhrase && <img className="HostView-PlayerPicture" src="/images/person-done.svg" /> }
								{ !playerSubmitPhrase && <img className="HostView-PlayerPicture" src="/images/typewriter.svg" /> }
								<div className="HostView-PlayerName">{ player.name }</div>
							</li>
						);
					}) }
				</ul>
			</>
		);
	}
	
	private _renderWaitingForPictureSubmissions() {
		const { gameData } = this.props;
		
		if (!gameData) {
			return null;
		}
		
		const currentRoundIndex = (gameData.currentRound - 1) / 2;
		
		return (
			<>
				<h1 className="HostView-Title">It’s time for art.</h1>
				<p className="HostView-BodyText">Players are drawing pictures.</p>
				<ul className="HostView-PlayersContainer">
					{ gameData.players.map(player => {
						console.log(gameData.pictures[currentRoundIndex]);
						const playerSubmitPicture = gameData.pictures[currentRoundIndex] && player.id in gameData.pictures[currentRoundIndex];
						
						return (
							<li className="HostView-Player" key={player.id}>
								{ playerSubmitPicture && <img className="HostView-PlayerPicture" src="/images/person-done.svg" /> }
								{ !playerSubmitPicture && <img className="HostView-PlayerPicture" src="/images/painting.svg" /> }
								<div className="HostView-PlayerName">{ player.name }</div>
							</li>
						);
					}) }
				</ul>
			</>
		);
	}
	
	private _renderWaitingToReviewStories() {
		return (
			<>
				<h1 className="HostView-Title">Ready to watch?</h1>
				<p className="HostView-BodyText">Control the stories on your phone.</p>
			</>
		);
	}
	
	private _renderReviewingStories() {
		const { gameData } = this.props;
		
		if (!gameData) {
			return null;
		}
		
		const owningPlayerOrder = gameData.presentingPlayer;
		const owningPlayer = gameData.players.find(p => p.order === owningPlayerOrder);
		
		const contributingPlayerOrder = (owningPlayerOrder + gameData.presentingRound) % Object.keys(gameData.players).length;
		const contributingPlayer = gameData.players.find(p => p.order === contributingPlayerOrder);
		
		if (!owningPlayer || !contributingPlayer) {
			return null;
		}
		
		const buildFrame = (round: number, classNameAddition: string) => {
			if (round < 0 || round >= gameData.rounds) {
				return null;
			}
			
			if (round % 2 === 0) {
				const phraseIndex = round / 2;
				const phrase = gameData.phrases[phraseIndex][contributingPlayer.id];
				const className = 'HostView-ReviewFrame HostView-ReviewFrame-Phrase ' + classNameAddition;
				return (
					<div className={className} key={`ReviewFrame-${round}`}>
						<p className="HostView-BodyText">{ phrase }</p>
					</div>
				);
			} else {
				const pictureIndex = (round - 1) / 2;
				const pictureData = gameData.pictures[pictureIndex][contributingPlayer.id];
				const className = 'HostView-ReviewFrame HostView-ReviewFrame-Picture ' + classNameAddition;
				return (
					<div className={className} key={`ReviewFrame-${round}`}>
						<div className="HostView-PictureContainer">
							<img className="HostView-Picture" src={pictureData} />
						</div>
					</div>
				);
			}
		};

		const previousFrame = buildFrame(gameData.presentingRound - 1, 'HostView-ReviewFrame-Previous');
		const currentFrame = buildFrame(gameData.presentingRound, 'HostView-ReviewFrame-Current');
		const nextFrame = buildFrame(gameData.presentingRound + 1, 'HostView-ReviewFrame-Next');
		
		return (
			<>
				<h1 className="HostView-Title">Story by { owningPlayer.name }:</h1>
				<div className="HostView-ReviewFrames">
					{ previousFrame }
					{ currentFrame }
					{ nextFrame }
				</div>
			</>
		);
	}
	
	private _renderPlayAgainOptions() {
		return (
			<>
				<h1 className="HostView-Title">Choose your destiny.</h1>
				<p className="HostView-BodyText">Want to play again? Choose an option on your phone.</p>
			</>
		);
	}
	
	private _renderGameState(gameData: GameData) {
		switch (gameData.state) {
		case GameState.WaitingForPlayers: return this._renderWaitingForPlayers();
		case GameState.WaitingForPhraseSubmissions: return this._renderWaitingForPhraseSubmissions();
		case GameState.WaitingForPictureSubmissions: return this._renderWaitingForPictureSubmissions();
		case GameState.WaitingToReviewStories: return this._renderWaitingToReviewStories();
		case GameState.ReviewingStories: return this._renderReviewingStories();
		case GameState.PlayAgainOptions: return this._renderPlayAgainOptions();
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
