import * as React from 'react';
import { RouteProps } from 'react-router';

export default class Error404Page extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('404 preloaded');
	}
	
	public static title = 'WordArt | 404';
	
	public componentDidMount() {
		document.title = Error404Page.title;
	}
	
	public render() {
		return (
			<div>
				<h1 className="Error404Page-SectionHeader">404 &ndash; Page Not Found</h1>
				<p className="Error404Page-Message">Looks like our pipes are broken. The page you requested doesn’t exist. Sorry about that!</p>
			</div>
		);
	}
};
