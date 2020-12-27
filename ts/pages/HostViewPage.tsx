import { parse as parseQueryString } from 'query-string';
import * as React from 'react';
import { RouteProps } from 'react-router';

import ClientGameManager from '../components/ClientGameManager';
import ClientGameManagerProvider from '../components/ClientGameManagerProvider';
import HostView from '../components/HostView';

export default class HostViewPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('host page preloaded');
	}

	public static title = 'Escape | Host';

	public componentDidMount() {
		document.title = HostViewPage.title;
	}

	public render() {
		const { location } = this.props;
		const queryParts = parseQueryString(location ? location.search || '' : '') || {};
		const showGameState = typeof queryParts.showGameState !== 'undefined';

		return (
			<ClientGameManagerProvider>
				<ClientGameManager>
					{(clientGameManager) => (
						<HostView clientGameManager={clientGameManager} showGameState={showGameState} />
					)}
				</ClientGameManager>
			</ClientGameManagerProvider>
		);
	}
}
