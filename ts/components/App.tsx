import * as React from 'react';
import { Route } from 'react-router-dom';

import HomePage from '../pages/HomePage';

export default () => (
	<div className="App">
		<Route path="/" component={HomePage}/>
	</div>
);
