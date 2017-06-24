import * as React from 'react';
import { ComponentBase } from 'resub';

import MBRouter from '../stores/MBRouter';
import PopupContainer from './PopupContainer';
import PopupStore, { PopupEntry } from '../stores/PopupStore';

interface AppProps extends React.Props<App> {}
interface AppState {
	content: JSX.Element | null;
	popup: PopupEntry | null;
}

export default class App extends ComponentBase<AppProps, AppState> {
	protected _buildState(_props: AppProps, _initialBuild: boolean): Partial<AppState> {
		return {
			content: MBRouter.getContent(),
			popup: PopupStore.getTopPopup()
		};
	}
	
	public render(): JSX.Element | null {
		let popup: JSX.Element | null = null;
		if (this.state.popup) {
			popup = (
				<PopupContainer canClickOut={ this.state.popup.canClickOut }>
					{ this.state.popup.content }
				</PopupContainer>
			);
		}
		
		return (
			<div className="App">
				{ this.state.content }
				{ popup }
			</div>
		);
	}
}
