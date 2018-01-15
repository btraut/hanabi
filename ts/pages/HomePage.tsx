import * as React from 'react';

export const title = 'Lost in Translation | Home';

export async function preload() {
	console.log('homepage preloaded');
};

export default class HomePage extends React.PureComponent<{}, {}> {
	public componentDidMount() {
		document.title = title;
	}
	
	public render() {
		return (
			<div>Here's the app!</div>
		);
	}
};
