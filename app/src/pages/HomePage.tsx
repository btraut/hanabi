import Page from 'app/src/pages/Page';
import useSetTitle from 'app/src/utils/client/useSetTitle';
import { Link } from 'react-router-dom';

const title = 'Ten Four Games | Home';

const HomePage: Page = () => {
	useSetTitle(title);

	return (
		<div className="HomePage">
			<div className="HomePage-Container">
				<h1 className="HomePage-Title">Ten Four</h1>
				<ul className="HomePage-Games">
					<li className="HomePage-Game">
						<Link to="/escape" className="HomePage-GameLink">
							Escape!
						</Link>
					</li>
					<li className="HomePage-Game">
						<Link to="/hanabi" className="HomePage-GameLink">
							Hanabi
						</Link>
					</li>
				</ul>
			</div>
		</div>
	);
};

HomePage.title = title;

export default HomePage;
