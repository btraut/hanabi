import * as React from 'react';
import { ComponentBase } from 'resub';

interface Error404PageProps extends React.Props<Error404Page> {}
interface Error404PageState {}

export default class Error404Page extends ComponentBase<Error404PageProps, Error404PageState> {
	public render(): JSX.Element | null {
		return (
			<div>
				<h1 className="Error404Page-SectionHeader">404 &ndash; Page Not Found</h1>
				<p className="Error404Page-Message">Looks like our pipes are broken. The page you requested doesn’t exist. Sorry about that!</p>
			</div>
		);
	}
}
