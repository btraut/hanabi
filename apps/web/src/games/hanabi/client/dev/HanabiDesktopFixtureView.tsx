import HanabiDesktopBoard from '~/games/hanabi/client/HanabiDesktopBoard';
import HanabiDesktopTableau from '~/games/hanabi/client/HanabiDesktopTableau';
import {
	getHanabiDesktopFixtures,
	HanabiDesktopFixtureName,
} from '~/games/hanabi/client/dev/HanabiDesktopFixtures';
import Error404Page from '~/pages/Error404Page';
import { Link, useParams } from 'react-router-dom';

export default function HanabiDesktopFixtureView(): JSX.Element {
	const { fixture: fixtureName } = useParams();
	const fixtures = getHanabiDesktopFixtures();
	const fixture = fixtures[fixtureName as HanabiDesktopFixtureName];

	if (!fixture) return <Error404Page />;

	return (
		<div className="hanabi-game-surface min-h-screen py-5">
			<header className="mx-auto mb-4 flex w-[calc(100vw-32px)] max-w-[1240px] items-start justify-between gap-4">
				<div>
					<p className="text-xs font-semibold uppercase tracking-[0.18em] text-hanabi-coral-soft">
						Development fixture
					</p>
					<h1 className="text-lg font-semibold text-hanabi-text">{fixture.name}</h1>
					<p className="text-sm text-hanabi-text-muted">{fixture.description}</p>
				</div>
				<nav aria-label="Desktop fixtures" className="flex max-w-xl flex-wrap justify-end gap-1.5">
					{Object.values(fixtures).map((item) => (
						<Link
							className="hanabi-focus-ring rounded-md border border-hanabi-border px-2 py-1 text-xs text-hanabi-text-muted hover:border-hanabi-border-bright hover:text-hanabi-text"
							key={item.name}
							to={`/dev/desktop/${item.name}`}
						>
							{item.name}
						</Link>
					))}
				</nav>
			</header>
			<HanabiDesktopBoard
				gameData={fixture.gameData}
				tableau={<HanabiDesktopTableau gameData={fixture.gameData} />}
				userId={fixture.userId}
			/>
		</div>
	);
}
