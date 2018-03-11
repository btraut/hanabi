import { models as wordArtModels, WordArtState } from './WordArt';
import { TypedModel } from './types';

// Combine all state types.
export type StoreData = WordArtState;

// Combine all reducers.
export const models: { [key: string]: TypedModel<any> } = {
	...wordArtModels
};
