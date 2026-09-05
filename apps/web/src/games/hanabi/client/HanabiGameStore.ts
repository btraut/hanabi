import {
	HANABI_MAX_ACTIONS,
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
	HanabiStage,
} from '@hanabi/shared';

export type HanabiBoardData = Omit<HanabiGameData, 'bots' | 'reviewTranscript'>;
export type HanabiActivityData = Pick<HanabiGameData, 'actions' | 'players' | 'turnOrder'>;
export type HanabiBotStatusData = Pick<
	HanabiGameData,
	'bots' | 'players' | 'currentPlayerId' | 'stage' | 'finishedReason'
>;

// Socket snapshots are JSON values with fresh object identities. Reuse equal
// branches so a subscription to one field stays quiet when another field changes.
function shareSnapshot<T>(previous: T, next: T): T {
	if (Object.is(previous, next)) return previous;
	if (
		previous === null ||
		next === null ||
		typeof previous !== 'object' ||
		typeof next !== 'object' ||
		Array.isArray(previous) !== Array.isArray(next)
	)
		return next;
	const previousRecord = previous as Record<string, unknown>;
	const nextRecord = next as Record<string, unknown>;
	const keys = Object.keys(nextRecord);
	let equal = Object.keys(previousRecord).length === keys.length;
	const entries = keys.map((key) => {
		const value = shareSnapshot(previousRecord[key], nextRecord[key]);
		if (!Object.hasOwn(previousRecord, key) || value !== previousRecord[key]) equal = false;
		return [key, value] as const;
	});
	if (equal) return previous;
	return (
		Array.isArray(next) ? entries.map(([, value]) => value) : Object.fromEntries(entries)
	) as T;
}

export class SnapshotChannel<T> {
	private snapshot: T;
	private readonly listeners = new Set<() => void>();
	public constructor(initial: T) {
		this.snapshot = initial;
	}
	public getSnapshot = (): T => this.snapshot;
	public subscribe = (listener: () => void): (() => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	public prepare(next: T): boolean {
		const shared = shareSnapshot(this.snapshot, next);
		if (shared === this.snapshot) return false;
		this.snapshot = shared;
		return true;
	}
	public publish(): void {
		this.listeners.forEach((listener) => listener());
	}
}

function boardActions(
	previous: HanabiBoardData | null,
	previousGame: HanabiGameData | null,
	next: HanabiGameData,
): readonly HanabiGameAction[] {
	const actions = next.actions.filter((action) => action.type !== HanabiGameActionType.Chat);
	if (!previous || next.stage === HanabiStage.Setup || previous.seed !== next.seed) return actions;
	const incomingById = new Map(actions.map((action) => [action.id, action]));
	const retained = previous.actions.map((action) => incomingById.get(action.id) ?? action);
	const lastReceivedId = previousGame?.actions.at(-1)?.id;
	const receivedOverlap = next.actions.findIndex((action) => action.id === lastReceivedId);
	if (receivedOverlap >= 0) {
		const appended = next.actions
			.slice(receivedOverlap + 1)
			.filter((action) => action.type !== HanabiGameActionType.Chat);
		if (appended.some((action) => action.type === HanabiGameActionType.GameStarted)) return actions;
		return [...retained, ...appended].slice(-HANABI_MAX_ACTIONS);
	}
	const last = previous.actions.at(-1);
	if (!last) return actions;
	const overlap = actions.findIndex((action) => action.id === last.id);
	if (overlap >= 0) {
		if (overlap === actions.length - 1) return retained;
		return [...retained, ...actions.slice(overlap + 1)].slice(-HANABI_MAX_ACTIONS);
	}
	// Chat can evict every gameplay event from the server's bounded mixed log.
	// Keep a separately bounded gameplay history, without manufacturing an event.
	if (actions.length === 0 && next.actions.length > 0) return previous.actions;
	return actions;
}

export class HanabiGameStore {
	public readonly game = new SnapshotChannel<HanabiGameData | null>(null);
	public readonly board = new SnapshotChannel<HanabiBoardData | null>(null);
	public readonly activity = new SnapshotChannel<HanabiActivityData | null>(null);
	public readonly bots = new SnapshotChannel<HanabiBotStatusData | null>(null);
	public constructor(initial?: HanabiGameData) {
		if (initial) this.receive(initial);
	}
	public receive = (incoming: HanabiGameData): void => {
		const previousGame = this.game.getSnapshot();
		if (!this.game.prepare(incoming)) return;
		const game = this.game.getSnapshot()!;
		const { bots, reviewTranscript: _reviewTranscript, ...board } = game;
		const boardChanged = this.board.prepare({
			...board,
			actions: boardActions(this.board.getSnapshot(), previousGame, game),
		});
		const activityChanged = this.activity.prepare({
			actions: game.actions,
			players: game.players,
			turnOrder: game.turnOrder,
		});
		const botsChanged = this.bots.prepare({
			bots,
			players: game.players,
			currentPlayerId: game.currentPlayerId,
			stage: game.stage,
			finishedReason: game.finishedReason,
		});
		// Every channel is current before any subscriber runs. Board presentation
		// may delay its own rendering, but cannot delay chat or authoritative state.
		this.game.publish();
		if (activityChanged) this.activity.publish();
		if (botsChanged) this.bots.publish();
		if (boardChanged) this.board.publish();
	};
}
