export default class Ajax {
	public static get<T>(url: string, headers?: Record<string, string>): Promise<T> {
		return this._request('get', url, null, headers);
	}

	public static post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
		return this._request('post', url, body, headers);
	}

	public static put<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
		return this._request('put', url, body, headers);
	}

	public static delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
		return this._request('delete', url, null, headers);
	}

	private static async _request<T>(
		method: string,
		url: string,
		body?: unknown,
		headers: Record<string, string> = {},
	): Promise<T> {
		try {
			let bodyString = null;

			if (body) {
				bodyString = typeof body === 'object' ? JSON.stringify(body) : body;
			}

			const headersObj = new Headers();
			headersObj.append('Content-Type', 'application/json');

			for (const key in headers) {
				if (typeof headers !== 'undefined') {
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
			throw new Error('The connection to Ten Four Games was lost.');
		}
	}
}
