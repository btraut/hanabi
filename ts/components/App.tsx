import * as React from 'react';
import { Route } from 'react-router-dom';
import { ComponentBase } from 'resub';

import HomePage from '../pages/HomePage';

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
				<Route path="/" component={HomePage}/>
				
				{ popup }
			</div>
		);
	}
}
