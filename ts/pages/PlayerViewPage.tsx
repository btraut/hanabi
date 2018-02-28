import * as React from 'react';
import { RouteProps } from 'react-router';
import { parse as parseQueryString } from 'query-string';

import PlayerView from '../components/PlayerView';
import ClientGameManagerProvider from '../components/ClientGameManagerProvider';
import ClientGameManager from '../components/ClientGameManager';

export default class PlayerViewPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('join page preloaded');
	}
	
	public static title = 'WordArt | Play';
	
	public componentDidMount() {
		document.title = PlayerViewPage.title;
	}
	
	public render() {
		const { location } = this.props;
		const queryParts = parseQueryString(location ? location.search || '' : '') || {};
		const showGameState = typeof queryParts.showGameState !== 'undefined';
		
		return (
			<ClientGameManagerProvider>
				<ClientGameManager>
					{clientGameManager => <PlayerView clientGameManager={clientGameManager} showGameState={showGameState} />}
				</ClientGameManager>
			</ClientGameManagerProvider>
		);
	}
};
