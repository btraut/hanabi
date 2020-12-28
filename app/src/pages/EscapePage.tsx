import { useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useClientSocketManagerContext } from '../components/ClientSocketManagerContext';
import Page from './Page';

const title = 'Escape | Play';

const EscapePage: Page = () => {
	const manager = useClientSocketManagerContext();

	useEffect(() => {
		manager.connect();

		return () => {
			manager.disconnect();
		};
	}, [manager]);

	useEffect(() => {
		document.title = title;
	}, []);

	return (
		<div className="EscapePage">
			<div className="EscapePage-Container">
				<h1 className="EscapePage-Title">Escape!</h1>
				<div className="EscapePage-DescriptionContainer">
					<p className="EscapePage-Description">
						Escape is a virtual escape room meant for 4-8 players.
					</p>
				</div>
				<div className="EscapePage-GameActions">
					<Link to="/host" className="EscapePage-GameAction">
						Host
					</Link>
					<Link to="/join" className="EscapePage-GameAction">
						Join
					</Link>
				</div>
			</div>
		</div>
	);
};

EscapePage.preload = async function () {
	console.log('GamePage preloaded');
};

EscapePage.title = title;

export default EscapePage;
