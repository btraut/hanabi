import * as React from 'react';
import { RouteProps } from 'react-router';

import GameView from '../components/GameView';
import ClientGameManagerProvider from '../components/ClientGameManagerProvider';

export default class GameViewPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('join page preloaded');
	}
	
	public static title = 'Lost in Translation | Join Game';
	
	public componentDidMount() {
		document.title = GameViewPage.title;
	}
	
	public render() {
		return (
			<ClientGameManagerProvider>
				<GameView />
			</ClientGameManagerProvider>
		);
	}
};
