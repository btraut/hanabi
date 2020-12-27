import { EscapeState,models as escapeModels } from './Escape';
import { TypedModel } from './types';

// Combine all state types.
export type StoreData = EscapeState;

// Combine all reducers.
export const models: { [key: string]: TypedModel<any> } = {
	...escapeModels,
};
