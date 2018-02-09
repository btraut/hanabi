import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { StoreData } from '../reducers/root';
import { GameState as GameReduxState } from '../reducers/Game';
import { GameState, GameData } from '../models/Game';
import withClientGameManager, { ClientGameManagerProviderPropsAdditions } from './withClientGameManager';

type ExternalHostViewProps = React.Props<HostViewPage>;
type HostViewProps = {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
} & ExternalHostViewProps & ClientGameManagerProviderPropsAdditions;

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
	
	public renderGameState(gameData: GameData) {
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
		const { connected, gameData, initialDataLoaded } = this.props;
		
		if (!connected) {
			return <div>Connecting…</div>;
		}
		
		if (!initialDataLoaded || !gameData) {
			return <div>Loading…</div>;
		}
		
		return (
			<div className="GameView">
				{ this.renderGameState(gameData) }
			</div>
		);
	}
};

export default compose(
	withClientGameManager,
	connect(({ game: { initialDataLoaded, connected, gameData } }: StoreData) => ({
		initialDataLoaded, connected, gameData
	}))
)(HostViewPage) as any as React.ComponentClass<ExternalHostViewProps>;
