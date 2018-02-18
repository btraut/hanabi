import * as React from 'react';
import * as PropTypes from 'prop-types';

import ClientGameManagerUtil from '../utils/ClientGameManager';

export interface ClientGameManagerProps {
	readonly children: (clientGameManager: ClientGameManagerUtil) => React.ReactNode;
}

export interface ClientGameManagerContext {
	readonly clientGameManager: ClientGameManagerUtil;
}

export interface ClientGameManagerPropsAdditions {
	readonly clientGameManager: ClientGameManagerUtil;
}

export default class ClientGameManager extends React.PureComponent<ClientGameManagerProps> {
	public static contextTypes = {
		clientGameManager: PropTypes.object
	};
	
	public context: ClientGameManagerContext;

	public render() {
		const { clientGameManager } = this.context;
		const { children } = this.props;
		
		return children(clientGameManager);
	}
}
