import * as React from 'react';
import { connect } from 'react-redux';

import { StoreData } from '../reducers/root';
import { ConnectionState, ClientSocketConnectionState } from '../reducers/ClientSocketConnection';

interface ExternalConnectionStatusProps {};

function ConnectionStatus({ connectionState }: ClientSocketConnectionState) {
	let statusText = '--loading--';
	
	switch (connectionState) {
		case ConnectionState.Connecting: statusText = 'Connecting'; break;
		case ConnectionState.Connected: statusText = 'Connected'; break;
		case ConnectionState.Disconnecting: statusText = 'Disconnecting'; break;
		case ConnectionState.Disconnected: statusText = 'Disconnected'; break;
	}
	
	return <div>{ statusText }</div>;
}

export default connect(({ clientSocketConnection }: StoreData) =>
	clientSocketConnection)(ConnectionStatus) as React.ComponentClass<ExternalConnectionStatusProps>;
