import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import Page from './Page';

const title = 'Escape | Home';

const HomePage: Page = () => {
	useEffect(() => {
		document.title = title;
	}, []);

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
};

HomePage.preload = async function () {
	console.log('homepage preloaded');
};

HomePage.title = title;

export default HomePage;
