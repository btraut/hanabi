import { HanabiGameActionType } from '@hanabi/shared';

type TransitionAction = {
	readonly id: string;
	readonly type: HanabiGameActionType;
	readonly tile?: { readonly id: string };
};

type TransitionState = {
	readonly actions: readonly TransitionAction[];
};

type TileViewTransition = {
	readonly ready: Promise<void>;
	readonly finished: Promise<void>;
	skipTransition(): void;
};

interface CoordinatorOptions<State extends TransitionState> {
	applyState(state: State, transitioningTileId: string | null): void;
	markTransitioningTile(tileId: string): void;
	clearTransitioningTile(): void;
	prefersReducedMotion(): boolean;
	startTransition?: (update: () => void) => TileViewTransition;
}

const TILE_ACTION_TYPES = new Set<HanabiGameActionType>([
	HanabiGameActionType.Play,
	HanabiGameActionType.Discard,
]);

export function getNewTileActionId(
	previousActions: readonly TransitionAction[],
	nextActions: readonly TransitionAction[],
): string | null {
	if (nextActions.length <= previousActions.length) {
		return null;
	}

	for (let index = 0; index < previousActions.length; index += 1) {
		if (previousActions[index].id !== nextActions[index].id) {
			return null;
		}
	}

	const tileActions = nextActions
		.slice(previousActions.length)
		.filter((action) => TILE_ACTION_TYPES.has(action.type));

	// A reconnect can append several missed turns in one refresh. There is no
	// intermediate DOM for those actions, so an immediate update is clearer
	// than a partial transition with missing compact-layout destinations.
	if (tileActions.length !== 1) {
		return null;
	}

	return tileActions[0].tile?.id ?? null;
}

export function getTileViewTransitionName(tileId: string): string {
	return `hanabi-tile-${tileId}`;
}

export class HanabiActionTransitionCoordinator<State extends TransitionState> {
	private readonly options: CoordinatorOptions<State>;
	private currentState: State | null = null;
	private activeTransition: {
		transition: TileViewTransition;
		update: { state: State; tileId: string; applied: boolean };
	} | null = null;
	private generation = 0;
	private disposed = false;

	public constructor(options: CoordinatorOptions<State>) {
		this.options = options;
	}

	public update(nextState: State): void {
		if (this.disposed) {
			return;
		}

		const previousState = this.currentState;
		this.currentState = nextState;

		// Status and position refreshes can follow an action before capture finishes.
		// Preserve the source DOM until the callback, and keep the latest snapshot.
		if (
			this.activeTransition &&
			previousState &&
			previousState.actions.length === nextState.actions.length &&
			previousState.actions.every((action, index) => action.id === nextState.actions[index].id)
		) {
			const { update } = this.activeTransition;
			update.state = nextState;
			if (update.applied) this.options.applyState(nextState, update.tileId);
			return;
		}

		this.generation += 1;
		const updateGeneration = this.generation;

		const transitioningTileId =
			previousState === null ? null : getNewTileActionId(previousState.actions, nextState.actions);
		const shouldAnimate =
			transitioningTileId !== null &&
			this.options.startTransition !== undefined &&
			!this.options.prefersReducedMotion();

		if (!shouldAnimate) {
			this.cancelActiveTransition();
			this.options.applyState(nextState, null);
			return;
		}

		this.cancelActiveTransition();
		this.options.markTransitioningTile(transitioningTileId);

		const update = { state: nextState, tileId: transitioningTileId, applied: false };
		try {
			const transition = this.options.startTransition!(() => {
				if (this.disposed || updateGeneration !== this.generation) {
					return;
				}

				update.applied = true;
				this.options.applyState(update.state, update.tileId);
			});
			this.activeTransition = { transition, update };

			// ready rejects when skipTransition interrupts capture. Observing it
			// prevents an otherwise harmless cancelation from becoming an
			// unhandledrejection event.
			void transition.ready.catch(() => undefined);
			void transition.finished
				.catch(() => undefined)
				.finally(() => {
					if (!this.disposed && this.activeTransition?.transition === transition) {
						this.activeTransition = null;
						this.options.clearTransitioningTile();
					}
				});
		} catch {
			this.options.applyState(nextState, null);
		}
	}

	public cleanUp(): void {
		this.disposed = true;
		this.generation += 1;
		this.cancelActiveTransition();
	}

	private cancelActiveTransition(): void {
		this.activeTransition?.transition.skipTransition();
		this.activeTransition = null;
	}
}
