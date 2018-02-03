import * as React from 'react';
import { RouteProps } from 'react-router';
import { Link } from 'react-router-dom';

import ConnectionStatus from '../components/ConnectionStatus';

export default class HomePage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('homepage preloaded');
	}
	
	public static title = 'Lost in Translation | Home';
	
	public componentDidMount() {
		document.title = HomePage.title;
	}
	
	public render() {
		return (
			<div className="HomePage">
				<p><Link to="/game">Join a Game</Link></p>
				<p><Link to="/host">Start a Game</Link></p>
				<ConnectionStatus />
			</div>
		);
	}
};
