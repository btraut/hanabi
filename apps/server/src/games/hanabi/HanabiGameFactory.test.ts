import { HANABI_MAX_ACTIONS, HanabiMessage, HanabiStage, PubSub, getScope } from '@hanabi/shared';
import { describe, expect, it, vi } from 'vitest';
import HanabiGameFactory from './HanabiGameFactory.js';
import ServerSocketManager from '../../utils/SocketManager.js';

function dependencies() {
	const onMessage = new PubSub<{ userId: string | undefined; message: HanabiMessage }>();
	const socketManager = {
		onMessage,
		onAuthenticate: new PubSub(),
		onDisconnect: new PubSub(),
		send: vi.fn(),
	} as unknown as ServerSocketManager;
	const store = {
		saveGame: vi.fn().mockResolvedValue(undefined),
		deleteGame: vi.fn().mockResolvedValue(undefined),
	};
	return { onMessage, socketManager, store };
}

describe('HanabiGameFactory', () => {
	it('hydrates valid data and resets persisted connection presence', () => {
		const factory = new HanabiGameFactory(1);
		const { onMessage, socketManager, store } = dependencies();
		const game = factory.create('creator', socketManager, store);
		onMessage.emit({
			userId: 'alice',
			message: {
				scope: getScope(game.title, game.id),
				type: 'AddPlayerMessage',
				data: { name: 'Alice' },
			},
		});
		onMessage.emit({
			userId: 'alice',
			message: {
				scope: getScope(game.title, game.id),
				type: 'StartGameMessage',
				data: undefined,
			},
		});

		const hydrated = factory.hydrate(game.serialize()!, socketManager, store);
		const persisted = JSON.parse(hydrated.serialize()!) as {
			data: { players: Record<string, { connected: boolean }>; stage: HanabiStage };
		};
		expect(persisted.data.players.alice.connected).toBe(false);
		expect(persisted.data.stage).toBe(HanabiStage.Playing);
		game.cleanUp();
		hydrated.cleanUp();
	});

	it('hydrates a started combined Rainbow and Black Powder game', () => {
		const factory = new HanabiGameFactory(1);
		const { onMessage, socketManager, store } = dependencies();
		const game = factory.create('creator', socketManager, store);
		const scope = getScope(game.title, game.id);
		onMessage.emit({
			userId: 'alice',
			message: { scope, type: 'AddPlayerMessage', data: { name: 'Alice' } },
		});
		onMessage.emit({
			userId: 'alice',
			message: {
				scope,
				type: 'ChangeGameSettingsMessage',
				data: { ruleSet: 'rainbow-black-powder' },
			},
		});
		onMessage.emit({
			userId: 'alice',
			message: { scope, type: 'StartGameMessage', data: undefined },
		});

		const hydrated = factory.hydrate(game.serialize()!, socketManager, store);
		const persisted = JSON.parse(hydrated.serialize()!) as {
			data: { ruleSet: string; tiles: Record<string, unknown> };
		};
		expect(persisted.data.ruleSet).toBe('rainbow-black-powder');
		expect(Object.keys(persisted.data.tiles)).toHaveLength(70);
		game.cleanUp();
		hydrated.cleanUp();
	});

	it('rejects invalid JSON with a useful hydration error', () => {
		const factory = new HanabiGameFactory();
		const { socketManager, store } = dependencies();

		expect(() => factory.hydrate('{bad json', socketManager, store)).toThrow(
			'Could not hydrate Hanabi game: persisted data is not valid JSON.',
		);
	});

	it('rejects malformed nested persisted data with its field path', () => {
		const factory = new HanabiGameFactory();
		const { socketManager, store } = dependencies();
		const game = factory.create('creator', socketManager, store);
		const persisted = JSON.parse(game.serialize()!) as Record<string, unknown>;
		(persisted.data as { players: unknown }).players = { alice: { id: 'alice', name: 42 } };

		expect(() => factory.hydrate(JSON.stringify(persisted), socketManager, store)).toThrow(
			'Could not hydrate Hanabi game: data.players.alice.connected must be a boolean.',
		);
		game.cleanUp();
	});

	it('rejects typed values that violate gameplay invariants', () => {
		const factory = new HanabiGameFactory();
		const { socketManager, store } = dependencies();
		const game = factory.create('creator', socketManager, store);
		const persisted = JSON.parse(game.serialize()!) as {
			data: { clues: number };
		};
		persisted.data.clues = 9;

		expect(() => factory.hydrate(JSON.stringify(persisted), socketManager, store)).toThrow(
			'Could not hydrate Hanabi game: data.clues must be an integer between 0 and 8.',
		);
		game.cleanUp();
	});

	it('rejects active games with terminal counters', () => {
		const factory = new HanabiGameFactory(1);
		const { onMessage, socketManager, store } = dependencies();
		const game = factory.create('creator', socketManager, store);
		onMessage.emit({
			userId: 'alice',
			message: {
				scope: getScope(game.title, game.id),
				type: 'AddPlayerMessage',
				data: { name: 'Alice' },
			},
		});
		onMessage.emit({
			userId: 'alice',
			message: {
				scope: getScope(game.title, game.id),
				type: 'StartGameMessage',
				data: undefined,
			},
		});
		const persisted = JSON.parse(game.serialize()!) as { data: { lives: number } };
		persisted.data.lives = 0;

		expect(() => factory.hydrate(JSON.stringify(persisted), socketManager, store)).toThrow(
			'Could not hydrate Hanabi game: playing games cannot have terminal life or turn counters.',
		);
		game.cleanUp();
	});

	it('trims oversized legacy action histories to the runtime limit', () => {
		const factory = new HanabiGameFactory();
		const { socketManager, store } = dependencies();
		const game = factory.create('creator', socketManager, store);
		const persisted = JSON.parse(game.serialize()!) as {
			data: { actions: unknown[] };
		};
		persisted.data.actions = Array.from({ length: HANABI_MAX_ACTIONS * 4 }, (_, index) => ({
			id: String(index),
			type: 'Chat',
			playerId: 'legacy-player',
			message: 'x'.repeat(500),
		}));

		const hydrated = factory.hydrate(JSON.stringify(persisted), socketManager, store);
		const hydratedData = JSON.parse(hydrated.serialize()!) as { data: { actions: unknown[] } };
		expect(hydratedData.data.actions).toHaveLength(HANABI_MAX_ACTIONS);
		expect(hydratedData.data.actions[0]).toMatchObject({ id: String(HANABI_MAX_ACTIONS * 3) });
		game.cleanUp();
		hydrated.cleanUp();
	});
});
