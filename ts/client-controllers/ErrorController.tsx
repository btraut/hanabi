import * as React from 'react';

import Error404Page from '../pages/Error404Page';
import { RouteResult, RouteRequest } from '../stores/Router';

class ErrorController {
	public async getError404(_req: RouteRequest, res: RouteResult) {
		res.content = <Error404Page />;
		res.title = 'Marying Brent | 404';
	}
}

const instance = new ErrorController();
export default instance;
