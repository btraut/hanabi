import * as React from 'react';
import { compose } from 'redux';
import { connect } from 'react-redux';
import * as JSONPretty from 'react-json-pretty';
import { withRouter, RouteComponentProps } from 'react-router';

import { StoreData } from '../reducers/root';
import { GameState, GameData } from '../models/Game';
import { ClientGameManagerPropsAdditions } from './ClientGameManager';

type ExternalHostViewProps = React.Props<HostViewPage> & ClientGameManagerPropsAdditions;
type HostViewProps = {
	readonly connected: boolean;
	readonly initialDataLoaded: boolean;
	readonly gameData: GameData | null;
} & ExternalHostViewProps & RouteComponentProps<any>;

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
		case GameState.WaitingForPhraseSubmissions: return <div>Players are submitting phrases…</div>;
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

export default (compose(
	connect(({ game: { initialDataLoaded, connected, gameData } }: StoreData) => ({
		initialDataLoaded, connected, gameData
	})) as any,
	withRouter as any
) as any)(HostViewPage) as any as React.ComponentClass<ExternalHostViewProps>;
