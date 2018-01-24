import * as React from 'react';
import { RouteProps } from 'react-router';

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
			<div>Here's the app!</div>
		);
	}
};
