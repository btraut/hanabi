import * as React from 'react';
import { RouteProps } from 'react-router';

import HostView from '../components/HostView';
import ClientGameManagerProvider from '../components/ClientGameManagerProvider';
import ClientGameManager from '../components/ClientGameManager';

export default class HostViewPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('host page preloaded');
	}
	
	public static title = 'WordArt | Start Game';
	
	public componentDidMount() {
		document.title = HostViewPage.title;
	}
	
	public render() {
		return (
			<ClientGameManagerProvider>
				<ClientGameManager>
					{clientGameManager => <HostView clientGameManager={clientGameManager} />}
				</ClientGameManager>
			</ClientGameManagerProvider>
		);
	}
};
