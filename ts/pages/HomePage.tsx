import * as React from 'react';
import { ComponentBase } from 'resub';

interface HomePageProps extends React.Props<HomePage> {}
interface HomePageState {}

export default class HomePage extends ComponentBase<HomePageProps, HomePageState> {
	public render(): JSX.Element | null {
		return (
			<div>Here's the app!</div>
		);
	}
}
