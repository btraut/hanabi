import * as React from 'react';
import { RouteProps } from 'react-router';

export default class HostPage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('host page preloaded');
	}
	
	public static title = 'Lost in Translation | Start Game';
	
	public componentDidMount() {
		document.title = HostPage.title;
	}
	
	public render() {
		const code = 'abc123';
		const url = `http://localhost:3000/game`;
		
		return (
			<div className="HostPage">
				<div>Have others join the game at:</div>
				<div>{ url } + { code }</div>
			</div>
		);
	}
};
