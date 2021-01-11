import { hanabiDragTypes } from 'app/src/games/hanabi/client/HanabiDragTypes';
import HanabiLoadGameView from 'app/src/games/hanabi/client/HanabiLoadGameView';
import HanabiMainMenu from 'app/src/games/hanabi/client/HanabiMainMenu';
import HanabiWatchForm from 'app/src/games/hanabi/client/HanabiWatchForm';
import { useDrop } from 'react-dnd';
import { Route, Switch } from 'react-router-dom';

export default function HanabiRouter(): JSX.Element {
	// The entire screen should be used as a drop target. This is to work around
	// a limitation of HTML5 drag and drop API where the "return animation" is
	// played when dropping things outside drop targets.
	const [, dropRef] = useDrop({
		accept: [hanabiDragTypes.TILE],
		drop: (_, monitor) => {
			if (monitor.getDropResult()) {
				return;
			}

			return { handled: false };
		},
	});

	return (
		<div
			className="w-screen min-h-screen flex flex-col justify-center items-center p-20"
			ref={dropRef}
		>
			<h1 className="mb-10 text-8xl italic text-white text-center text-shadow">Hanabi</h1>
			<Switch>
				<Route path="/hanabi/join" exact>
					<HanabiWatchForm />
				</Route>
				<Route path="/hanabi/:code" exact>
					<HanabiLoadGameView />
				</Route>
				<Route path="/hanabi" exact>
					<HanabiMainMenu />
				</Route>
			</Switch>
		</div>
	);
}
