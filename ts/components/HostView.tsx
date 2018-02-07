import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { StoreData } from '../reducers/root';
import { GameState as GameReduxState } from '../reducers/Game';
import { GameState } from '../models/Game';
import withClientGameManager, { ClientGameManagerProviderPropsAdditions } from './withClientGameManager';

type ExternalHostViewProps = React.Props<HostViewPage>;
type HostViewProps = {
	game: GameReduxState
} & ExternalHostViewProps & ClientGameManagerProviderPropsAdditions;

class HostViewPage extends React.PureComponent<HostViewProps> {
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
		case GameState.WaitingForPlayers: return <div>Players are joining…</div>;
		case GameState.WaitingForPlayerDescriptions: return <div>Players are naming themselves…</div>;
		case GameState.WaitingForTextSubmissions: return <div>Players are submitting text…</div>;
		case GameState.WaitingForPictureSubmissions: return <div>Players are submitting drawings…</div>;
		case GameState.ReviewingStories: return <div>Reviewing sequences…</div>;
		case GameState.PlayAgainOptions: return <div>Play again?</div>;
		}
	}
	
	public render() {
		const { game: { connected, gameData } } = this.props;
		
		return (
			<div className="GameView">
				{ !connected && <p>Connecting…</p> }
				{ connected && !gameData && <p>Loading…</p> }
				{ this.renderGameState() }
			</div>
		);
	}
};

export default compose(
	withClientGameManager,
	connect(({ game }: StoreData) => ({ game }))
)(HostViewPage) as any as React.ComponentClass<ExternalHostViewProps>;
