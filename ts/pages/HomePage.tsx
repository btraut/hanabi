import * as React from 'react';
import { RouteProps } from 'react-router';
import { Link } from 'react-router-dom';

import Canvas from '../components/Canvas';

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
				<p><Link to="/join">Join a Game</Link></p>
				<p><Link to="/host">Start a Game</Link></p>
				<Canvas style={{ height: 500 }} />
			</div>
		);
	}
};
