import { HanabiAnimatable, HanabiAnimatableDrawTile } from 'app/src/games/hanabi/HanabiAnimatables';
import { HanabiGameActionType, HanabiGameData } from 'app/src/games/hanabi/HanabiGameData';

export default class HanabiAnimatableBuilder {
	public static buildAnimatables(
		previousState: HanabiGameData,
		newState: HanabiGameData,
	): HanabiAnimatable[] {
		const animatables: HanabiAnimatable[] = [];

		// For now, we'll use the list of actions to determine which animatables
		// to build. This might not be enough in the future if we to animate
		// stuff that isn't represented as actions.
		if (newState.actions.length > previousState.actions.length) {
			for (
				let actionKey = previousState.actions.length + 1;
				actionKey <= newState.actions.length;
				actionKey += 1
			) {
				const action = newState.actions[actionKey];

				// Add an animation if the player drew a new tile.
				if (
					action.type === HanabiGameActionType.Play ||
					action.type === HanabiGameActionType.Discard
				) {
					let newTileId: null | string = null;
					if (
						previousState.players[action.playerId].tileLocations.length ===
						newState.players[action.playerId].tileLocations.length
					) {
						newTileId =
							newState.players[action.playerId].tileLocations[
								newState.players[action.playerId].tileLocations.length - 1
							].tile.id;
					}

					if (newTileId !== null) {
						const animatable: HanabiAnimatableDrawTile = {
							playerId: action.playerId,
							tileId: newTileId,
						};

						animatables.push(animatable);
					}
				}
			}
		}

		return animatables;
	}
}
