import * as React from 'react';
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
		
		switch (game.state) {
		case ClientGameManagerState.Connecting: return <div>Loading…</div>;
		case ClientGameManagerState.Disconnected: return <div>Disconnected. Reconnecting…</div>;
		case ClientGameManagerState.WaitingForInitialData: return <div>WaitingForInitialData…</div>;
		case ClientGameManagerState.JoinGame: return <div>JoinGame…</div>;
		case ClientGameManagerState.InGameLobby: return <div>InGameLobby…</div>;
		case ClientGameManagerState.NameYourself: return <div>NameYourself…</div>;
		case ClientGameManagerState.DrawYourself: return <div>DrawYourself…</div>;
		case ClientGameManagerState.WaitingForGameToBegin: return <div>WaitingForGameToBegin…</div>;
		case ClientGameManagerState.EnterText: return <div>EnterText…</div>;
		case ClientGameManagerState.WaitingForOthersToEnterText: return <div>WaitingForOthersToEnterText…</div>;
		case ClientGameManagerState.DrawPicture: return <div>DrawPicture…</div>;
		case ClientGameManagerState.WaitingForOthersToDrawPicture: return <div>WaitingForOthersToDrawPicture…</div>;
		case ClientGameManagerState.ReviewingSequences: return <div>ReviewingSequences…</div>;
		case ClientGameManagerState.PlayAgainOptions: return <div>PlayAgainOptions…</div>;
		}
		
		return null;
	}
};

export default compose(
	withClientGameManager,
	connect(({ game }: StoreData) => ({ game }))
)(GameViewPage) as any as React.ComponentClass<ExternalGameViewProps>;
