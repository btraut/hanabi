import * as React from 'react';
import { Link } from 'react-router-dom';
import { compose } from 'redux';
import { connect } from 'react-redux';

import { StoreData } from '../reducers/root';
import { GameState } from '../reducers/Game';
import ClientGameManagerState from '../models/ClientGameManagerState';
import withClientGameManager, { ClientGameManagerProviderPropsAdditions } from './withClientGameManager';

type ExternalGameViewProps = React.Props<GameViewPage>;
type GameViewProps = {
	game: GameState
} & ExternalGameViewProps & ClientGameManagerProviderPropsAdditions;

class GameViewPage extends React.PureComponent<GameViewProps> {
	public componentDidMount() {
		this.props.clientGameManager.connect();
	}
	
	public componentWillUnmount() {
		this.props.clientGameManager.disconnect();
	}
	
	public render() {
		const { game } = this.props;
		
		let stateText = '';
		switch (game.state) {
		case ClientGameManagerState.Connecting: stateText = 'Connecting'; break;
		case ClientGameManagerState.Disconnected: stateText = 'Disconnected'; break;
		default: stateText = 'Connected! Waiting for server.'; break;
		}
		
		return (
			<div>
				<p><Link to="/">Home</Link></p>
				<p>{ stateText }</p>
			</div>
		);
	}
};

export default compose(
	withClientGameManager,
	connect(({ game }: StoreData) => ({ game }))
)(GameViewPage) as any as React.ComponentClass<ExternalGameViewProps>;
