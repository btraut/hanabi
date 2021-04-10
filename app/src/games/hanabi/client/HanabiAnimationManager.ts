// The purpose of HanabiAnimationManager is to subscribe to state changes in
// game data, determine the relevant differences, and create/coordinate
// animations between those states. React is great at making immediate changes
// to data, but we need to introduce a temporal element to those transitions.
//
// Note: All the state we hold in this class is specific to the viewing user and
// none of it is sent back up the wire.

import HanabiGame from 'app/src/games/hanabi/client/HanabiGame';
import {
	HanabiGameAction,
	HanabiGameActionType,
	HanabiGameData,
} from 'app/src/games/hanabi/HanabiGameData';
import PubSub from 'app/src/utils/PubSub';

export default class HanabiAnimationManager {
	public onUpdate = new PubSub<void>();

	// This is the latest game data that the UI should display.
	private _displayGameData: HanabiGameData;
	public get displayGameData(): HanabiGameData {
		return this._displayGameData;
	}

	// List all the animations that should play.
	private _animateActions: HanabiGameAction[] = [];
	public get animateActions(): HanabiGameAction[] {
		return this._animateActions;
	}

	private _game: HanabiGame;
	private _gameOnUpdateSubscriptionIdRef: number;

	private _lastHandledGameState: HanabiGameData;
	private _animatingGameState: HanabiGameData | null = null;

	private _gameStateQueue: HanabiGameData[] = [];

	constructor(game: HanabiGame) {
		this._game = game;
		this._lastHandledGameState = game.gameData;
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
		if (this._gameStateQueue.length && !this._animatingGameState) {
			this._handleNextGameState();
		}
	}

	private _handleNextGameState() {
		if (this._gameStateQueue.length === 0) {
			throw new Error('Empty game state queue!');
		}

		if (this._animatingGameState) {
			throw new Error('Can’t animate game state while animation is in flight!');
		}

		const nextGameState = this._gameStateQueue.shift()!;

		// Don't animate if the game has ended.
		if (nextGameState.finishedReason) {
			this._replaceStateAndAdvance(nextGameState);
			return;
		}

		// Check if we're skipping way ahead in time or if we're only handling a
		// single action. We're only going to animate if it's a single action.
		if (nextGameState.actions.length - this._lastHandledGameState.actions.length !== 1) {
			this._replaceStateAndAdvance(nextGameState);
			return;
		}

		// Grab the latest action.
		const action = nextGameState.actions[nextGameState.actions.length - 1];

		// Only animate if the action is a discard or play. We could animate
		// clues or other stuff in the future, but for now, this is it.
		if (action.type !== HanabiGameActionType.Discard && action.type !== HanabiGameActionType.Play) {
			this._replaceStateAndAdvance(nextGameState);
			return;
		}

		// Set up the animations.
		this._animateActions = [action];
		this._animatingGameState = nextGameState;

		// Copy the next game state to the display state.
		this._displayGameData = { ...nextGameState };

		// Since we're animating a discard or a play and the user has picked up
		// a new tile, we need to hide the new and old tiles. The animations
		// will display both of these.
		this._displayGameData.players = { ...this._displayGameData.players };
		this._displayGameData.players[action.playerId] = {
			...this._displayGameData.players[action.playerId],
		};
		this._displayGameData.players[action.playerId].tileLocations = this._displayGameData.players[
			action.playerId
		].tileLocations.filter(
			(tl) => tl.tile.id !== action.newTile?.id && tl.tile.id !== action.tile.id,
		);

		// We also need to hide the tile from the played/discarded pile until
		// the animation is finished.
		if (action.type === HanabiGameActionType.Play) {
			this._displayGameData.playedTiles = this._displayGameData.playedTiles.filter(
				(t) => t.id !== action.tile.id,
			);
		} else if (action.type === HanabiGameActionType.Discard) {
			this._displayGameData.discardedTiles = this._displayGameData.discardedTiles.filter(
				(t) => t.id !== action.tile.id,
			);
		}

		// Update. This will cause the animators to start animating.
		this.onUpdate.emit();

		// TODO: For now, we'll just auto-advance after a second.
		setTimeout(() => {
			this.animationsCompleted();
		}, 1000);
	}

	private _replaceStateAndAdvance(nextGameState: HanabiGameData) {
		this._animateActions = [];
		this._animatingGameState = null;
		this._displayGameData = nextGameState;
		this._lastHandledGameState = nextGameState;

		this.onUpdate.emit();

		this._executeQueueIfIdle();
	}

	// The animation component should call this when all animations are
	// complete.
	public animationsCompleted(): void {
		if (!this._animatingGameState) {
			throw new Error('Can’t complete animation if we’re not animating!');
		}

		this._lastHandledGameState = this._animatingGameState;
		this._animatingGameState = null;
		this._animateActions = [];

		this._executeQueueIfIdle();
	}
}
