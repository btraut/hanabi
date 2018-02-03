import * as React from 'react';
import { connect, Dispatch } from 'react-redux';
import { Link } from 'react-router-dom';

import { StoreData } from '../reducers/root';
import ClientGameManager from '../utils/ClientGameManager';
import ConnectionStatus from './ConnectionStatus';

interface ExternalGameViewProps {}
interface GameViewProps extends ExternalGameViewProps {
	dispatch: Dispatch<StoreData>;
}

class GameViewPage extends React.PureComponent<GameViewProps> {
	private _clientGameManager: ClientGameManager;
	
	constructor(props: GameViewProps) {
		super(props);
		
		this._clientGameManager = new ClientGameManager(props.dispatch);
	}
	
	public componentDidMount() {
		this._clientGameManager.connect();
	}
	
	public componentWillUnmount() {
		this._clientGameManager.disconnect();
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

export default connect()(GameViewPage) as React.ComponentClass<ExternalGameViewProps>;
