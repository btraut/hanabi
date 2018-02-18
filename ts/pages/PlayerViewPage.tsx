import * as React from 'react';
import { RouteProps } from 'react-router';

import PlayerView from '../components/PlayerView';
import ClientGameManagerProvider from '../components/ClientGameManagerProvider';
import ClientGameManager from '../components/ClientGameManager';

export default class PlayerViewPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('join page preloaded');
	}
	
	public static title = 'Lost in Translation | Join Game';
	
	public componentDidMount() {
		document.title = PlayerViewPage.title;
	}
	
	public render() {
		return (
			<ClientGameManagerProvider>
				<ClientGameManager>
					{clientGameManager => <PlayerView clientGameManager={clientGameManager} />}
				</ClientGameManager>
			</ClientGameManagerProvider>
		);
	}
};
