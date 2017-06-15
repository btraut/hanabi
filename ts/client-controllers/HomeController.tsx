import * as React from 'react';

import HomePage from '../pages/HomePage';
import { RouteResult, RouteRequest } from '../stores/Router';

class UserController {
	public async getHome(_req: RouteRequest, res: RouteResult) {
		res.content = <HomePage />;
		res.title = 'Marying Brent | May 19, 2018';
	}
}

const instance = new UserController();
export default instance;
