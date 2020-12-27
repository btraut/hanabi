export default class Ajax {
	public static get(url: string, headers?: any) {
		return this._request('get', url, null, headers);
	}

	public static post(url: string, body?: any, headers?: any) {
		return this._request('post', url, body, headers);
	}

	public static put(url: string, body?: any, headers?: any) {
		return this._request('put', url, body, headers);
	}

	public static delete(url: string, headers?: Headers) {
		return this._request('delete', url, null, headers);
	}

	private static async _request(method: string, url: string, body?: any, headers: any = {}) {
		try {
			let bodyString = null;

			if (body) {
				bodyString = typeof body === 'object' ? JSON.stringify(body) : body;
			}

			const headersObj = new Headers();
			headersObj.append('Content-Type', 'application/json');

			for (const key in headers) {
				if (headers.hasOwnProperty(key)) {
					headersObj.append(key, headers[key]);
				}
			}

			const fetchParams: { [key: string]: any } = {
				method,
				headers: headersObj,
				credentials: 'same-origin',
			};

			if (bodyString) {
				fetchParams.body = bodyString;
			}

			const response = await fetch(url, fetchParams);

			const json = await response.json();

			return json;
		} catch (error) {
			throw new Error('The connection to Escape was… uh… lost.');
		}
	}
}
