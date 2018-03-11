export interface TypedModel<S> {
	name?: string;
	state: S;
	reducers?: { [key: string]: (state: S, payload?: any) => S; };
	effects?: { [key: string]: (payload: any, state: any) => void };
	selectors?: { [key: string]: (state: any, arg?: any) => any };
	subscriptions?: { [matcher: string]: (action: any) => void };
}
