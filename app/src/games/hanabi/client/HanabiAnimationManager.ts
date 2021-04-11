// The purpose of HanabiAnimationManager is to subscribe to state changes in
// game data, determine the relevant differences, and create/coordinate
// animations between those states. React is great at making immediate changes
// to data, but we need to introduce a temporal element to those transitions.
//
// Note: All the state we hold in this class is specific to the viewing user and
// none of it is sent back up the wire.

import HanabiAnimatableBuilder from 'app/src/games/hanabi/client/HanabiAnimatableBuilder';
import HanabiGame from 'app/src/games/hanabi/client/HanabiGame';
import { HanabiAnimatable } from 'app/src/games/hanabi/HanabiAnimatables';
import { HanabiGameData } from 'app/src/games/hanabi/HanabiGameData';
import PubSub from 'app/src/utils/PubSub';
import { v4 as uuidv4 } from 'uuid';

export default class HanabiAnimationManager {
	public onUpdate = new PubSub<void>();

	// This is the latest game data that the UI should display.
	private _displayGameData: HanabiGameData;
	public get displayGameData(): HanabiGameData {
		return this._displayGameData;
	}

	// List all the animations that should play.
	private _animating = false;
	private _animatables: { [id: string]: HanabiAnimatable } = {};
	public get animatables(): { [id: string]: HanabiAnimatable } {
		return this._animatables;
	}

	private _game: HanabiGame;
	private _gameOnUpdateSubscriptionIdRef: number;

	private _gameStateQueue: HanabiGameData[] = [];

	constructor(game: HanabiGame) {
		this._game = game;
		this._displayGameData = game.gameData;
		this._gameOnUpdateSubscriptionIdRef = game.onUpdate.subscribe(this._handleUpdate);
	}

	public cleanUp(): void {
		this._game.onUpdate.unsubscribe(this._gameOnUpdateSubscriptionIdRef);
	}

	private _handleUpdate = () => {
		this._gameStateQueue.push(this._game.gameData);
		this._executeQueueIfIdle();
	};

	private _executeQueueIfIdle() {
		if (this._gameStateQueue.length && !this._animating) {
			this._handleNextGameState();
		}
	}

	private _handleNextGameState() {
		if (this._gameStateQueue.length === 0) {
			throw new Error('Empty game state queue!');
		}

		if (this._animating) {
			throw new Error('Can’t animate game state while animation is in flight!');
		}

		const nextGameState = this._gameStateQueue.shift()!;

		// Don't animate if the game has ended.
		if (nextGameState.finishedReason) {
			this._replaceStateAndAdvance(nextGameState);
			return;
		}

		// Create animations for each animatable change.
		const animatables = HanabiAnimatableBuilder.buildAnimatables(
			this._displayGameData,
			nextGameState,
		);

		// If there's nothing to animate, we can skip to the next state.
		if (animatables.length === 0) {
			this._replaceStateAndAdvance(nextGameState);
			return;
		}

		this._animating = true;
		this._animatables = {};

		for (const animatable of animatables) {
			this._animatables[uuidv4()] = animatable;
		}

		// Copy the next game state to the display state.
		this._displayGameData = { ...nextGameState };

		// Update. This will cause the animators to start animating.
		this.onUpdate.emit();

		// TODO: For now, we'll just auto-advance after a second.
		setTimeout(() => {
			this._handleAllAnimationsComplete();
		}, 1000);
	}

	private _replaceStateAndAdvance(nextGameState: HanabiGameData) {
		this._animating = false;
		this._animatables = {};
		this._displayGameData = nextGameState;

		this.onUpdate.emit();

		this._executeQueueIfIdle();
	}

	// The animation component should call this when an animation is complete.
	public animationsCompleted(id: string): void {
		delete this._animatables[id];

		if (Object.keys(this._animatables).length === 0) {
			this._handleAllAnimationsComplete();
		}
	}

	private _handleAllAnimationsComplete() {
		this._animating = false;
		this._animatables = {};

		this._executeQueueIfIdle();
	}
}
