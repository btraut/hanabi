import * as React from 'react';
import { Link } from 'react-router-dom';

import ConnectionStatus from './ConnectionStatus';
import withClientGameManager, { ClientGameManagerProviderPropsAdditions } from './withClientGameManager';

type GameViewProps = ClientGameManagerProviderPropsAdditions;

class GameViewPage extends React.PureComponent<GameViewProps> {
	public componentDidMount() {
		this.props.clientGameManager.connect();
	}
	
	public componentWillUnmount() {
		this.props.clientGameManager.disconnect();
	}
	
	public render() {
		return (
			<div>
				<p><Link to="/">Home</Link></p>
				<ConnectionStatus />
			</div>
		);
	}
};

export default withClientGameManager(GameViewPage);
