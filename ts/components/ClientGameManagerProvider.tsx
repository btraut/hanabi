import * as React from 'react';
import * as PropTypes from 'prop-types';
import { connect, DispatchProp } from 'react-redux';

import { StoreData } from '../reducers/root';
import ClientGameManager from '../utils/ClientGameManager';

type ClientGameManagerProviderProps = DispatchProp<StoreData>;

class ClientGameManagerProvider extends React.PureComponent<ClientGameManagerProviderProps> {
	private _clientGameManager: ClientGameManager;
	
	constructor(props: ClientGameManagerProviderProps) {
		super(props);
		
		this._clientGameManager = new ClientGameManager(props.dispatch!);
	}
	
	public getChildContext() {
		return { clientGameManager: this._clientGameManager };
	}
	
	public static childContextTypes = {
		clientGameManager: PropTypes.object
	};
	
	public render() {
		return this.props.children;
	}
}

export default connect()(ClientGameManagerProvider);
