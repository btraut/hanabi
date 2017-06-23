import * as React from 'react';
import { ComponentBase } from 'resub';

import MBRouter from '../stores/MBRouter';

interface AppProps extends React.Props<App> {}
interface AppState {
	content: JSX.Element | null;
}

export default class App extends ComponentBase<AppProps, AppState> {
	protected _buildState(_props: AppProps, _initialBuild: boolean): Partial<AppState> {
		return {
			content: MBRouter.getContent()
		};
	}
	
	public render(): JSX.Element | null {
		return this.state.content;
	}
}
