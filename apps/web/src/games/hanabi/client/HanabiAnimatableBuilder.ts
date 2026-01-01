import { HanabiAnimatable, HanabiAnimatableDrawTile } from '@hanabi/shared';
import { HanabiGameActionType, HanabiGameData } from '@hanabi/shared';

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
				actionKey < newState.actions.length;
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
						previousState.playerTiles[action.playerId].length ===
						newState.playerTiles[action.playerId].length
					) {
						newTileId =
							newState.playerTiles[action.playerId][
								newState.playerTiles[action.playerId].length - 1
							];
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
