import * as React from 'react';
import { RouteProps } from 'react-router';
import { Link } from 'react-router-dom';

export default class HomePage extends React.PureComponent<RouteProps> {
	public static async preload() {
		console.log('homepage preloaded');
	}

	public static title = 'Escape | Home';

	public componentDidMount() {
		document.title = HomePage.title;
	}

	public render() {
		return (
			<div className="HomePage">
				<div className="HomePage-Container">
					<h1 className="HomePage-Title">Escape</h1>
					<div className="HomePage-DescriptionContainer">
						<p className="HomePage-Description">Escape is a virtual escape room.</p>
					</div>
					<div className="HomePage-GameActions">
						<Link to="/host" className="HomePage-GameAction">
							Host
						</Link>
						<Link to="/join" className="HomePage-GameAction">
							Join
						</Link>
					</div>
				</div>
			</div>
		);
	}
}
