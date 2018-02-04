import * as React from 'react';
import * as PropTypes from 'prop-types';

import ClientGameManager from '../utils/ClientGameManager';

export interface ClientGameManagerProviderPropsAdditions {
	clientGameManager: ClientGameManager;
}

export default function withClientGameManager<P extends React.Props<any>>(Subject: React.ComponentClass<P & ClientGameManagerProviderPropsAdditions>) {
	class WithClientGameManager extends React.PureComponent<P & ClientGameManagerProviderPropsAdditions> {
		public static contextTypes = {
			clientGameManager: PropTypes.object
		};

		public render() {
			const clientGameManager: ClientGameManager = this.context.clientGameManager;
			return <Subject clientGameManager={clientGameManager} { ...this.props } />;
		}
	}
	
	return WithClientGameManager as any as React.ComponentClass<P>;
}
