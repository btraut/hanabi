import { useEffect } from 'react';

import { useClientSocketManagerContext } from '../components/ClientSocketManagerContext';
import Page from './Page';

const title = 'Escape | Play';

const GamePage: Page = () => {
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

	return <div className="GamePage">Game</div>;
};

GamePage.preload = async function () {
	console.log('GamePage preloaded');
};

GamePage.title = title;

export default GamePage;
