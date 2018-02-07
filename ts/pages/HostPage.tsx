import * as React from 'react';
import { RouteProps } from 'react-router';

import HostView from '../components/HostView';
import ClientGameManagerProvider from '../components/ClientGameManagerProvider';

export default class HostPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('host page preloaded');
	}
	
	public static title = 'Lost in Translation | Start Game';
	
	public componentDidMount() {
		document.title = HostPage.title;
	}
	
	public render() {
		return (
			<ClientGameManagerProvider>
				<HostView />
			</ClientGameManagerProvider>
		);
	}
};
