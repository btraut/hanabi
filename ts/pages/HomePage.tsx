import * as React from 'react';
import { RouteProps } from 'react-router';
import { Link } from 'react-router-dom';

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
				<div className="HomePage-Container">
					<h1 className="HomePage-Title">WordArt</h1>
					<div className="HomePage-DescriptionContainer">
						<p className="HomePage-Description">WordArt is a party game that combines drawing and interpretation.</p>
						<p className="HomePage-Description">It’s like the classic game of Telephone, but it’s actually fun!</p>
					</div>
					<ul className="HomePage-GameActionsList">
						<li className="HomePage-GameActionsListItem"><Link to="/host" className="HomePage-GameAction">Host</Link></li>
						<li className="HomePage-GameActionsListItem"><Link to="/join" className="HomePage-GameAction">Join</Link></li>
					</ul>
				</div>
			</div>
		);
	}
};
