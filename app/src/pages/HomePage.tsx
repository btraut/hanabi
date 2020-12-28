import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import Page from './Page';

const title = 'Ten Four Games | Home';

const HomePage: Page = () => {
	useEffect(() => {
		document.title = title;
	}, []);

	return (
		<div className="HomePage">
			<div className="HomePage-Container">
				<h1 className="HomePage-Title">Ten Four Games</h1>
				<ul className="HomePage-Games">
					<li className="HomePage-Game">
						<Link to="/escape" className="HomePage-GameLink">
							Escape – virtual escape room
						</Link>
					</li>
				</ul>
			</div>
		</div>
	);
};

HomePage.preload = async function () {
	console.log('homepage preloaded');
};

HomePage.title = title;

export default HomePage;
