import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { StoreData } from '../reducers/root';
import { GameState as GameReduxState } from '../reducers/Game';
import { GameState } from '../models/Game';
import withClientGameManager, { ClientGameManagerProviderPropsAdditions } from './withClientGameManager';

type ExternalGameViewProps = React.Props<GameViewPage>;
type GameViewProps = {
	readonly game: GameReduxState
} & ExternalGameViewProps & ClientGameManagerProviderPropsAdditions;

class GameViewPage extends React.PureComponent<GameViewProps> {
	public componentDidMount() {
		this.props.clientGameManager.connect();
	}
	
	public componentWillUnmount() {
		this.props.clientGameManager.disconnect();
	}
	
	public renderGameState() {
		const { game: { gameData } } = this.props;

		if (!gameData) {
			return <div><p>Join Game:</p><input /><input type="submit" value="Join" /></div>;
		}
		
		switch (gameData.state) {
		case GameState.WaitingForPlayers: return <div>InGameLobby…</div>;
		
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
		const { game: { connected } } = this.props;
		
		return (
			<div className="GameView">
				{ !connected && <p>Connecting…</p> }
				{ this.renderGameState() }
			</div>
		);
	}
};

export default compose(
	withClientGameManager,
	connect(({ game }: StoreData) => ({ game }))
)(GameViewPage) as any as React.ComponentClass<ExternalGameViewProps>;
