import * as React from 'react';
import { RouteProps } from 'react-router';

export default class JoinPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('join page preloaded');
	}
	
	public static title = 'Lost in Translation | Join Game';
	
	public componentDidMount() {
		document.title = JoinPage.title;
	}
	
	public render() {
		return (
			<div className="JoinPage">
				<div>What's your game code?</div>
				<input type="text" />
			</div>
		);
	}
};
