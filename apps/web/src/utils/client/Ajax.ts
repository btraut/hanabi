export default class Ajax {
	public static get<T>(
		url: string,
		headers?: Record<string, string>,
		timeout = 10_000,
	): Promise<T> {
		return this._request('get', url, undefined, headers, timeout);
	}

	public static post<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
		return this._request('post', url, body, headers);
	}

	public static put<T>(url: string, body?: unknown, headers?: Record<string, string>): Promise<T> {
		return this._request('put', url, body, headers);
	}

	public static delete<T>(url: string, headers?: Record<string, string>): Promise<T> {
		return this._request('delete', url, undefined, headers);
	}

	private static async _request<T>(
		method: string,
		url: string,
		body?: unknown,
		headers: Record<string, string> = {},
		timeout = 10_000,
	): Promise<T> {
		const abortController = new AbortController();
		const timeoutToken = setTimeout(() => abortController.abort(), timeout);
		try {
			let bodyString: string | null = null;

			if (body !== undefined) {
				bodyString = typeof body === 'string' ? body : (JSON.stringify(body) ?? null);
			}

			const headersObj = new Headers();
			headersObj.append('Content-Type', 'application/json');

			for (const key in headers) {
				if (typeof headers !== 'undefined') {
					headersObj.append(key, headers[key]);
				}
			}

			const fetchParams: RequestInit = {
				method,
				headers: headersObj,
				credentials: 'same-origin',
				signal: abortController.signal,
			};

			if (bodyString) {
				fetchParams.body = bodyString;
			}

			const response = await fetch(url, fetchParams);
			if (!response.ok) {
				throw new Error(`Request failed with HTTP ${response.status}.`);
			}

			return (await response.json()) as T;
		} catch (error) {
			if (abortController.signal.aborted) {
				throw new Error('The request timed out.', { cause: error });
			}
			if (error instanceof Error && error.message.startsWith('Request failed with HTTP ')) {
				throw error;
			}
			throw new Error('The connection to Ten Four Games was lost.', { cause: error });
		} finally {
			clearTimeout(timeoutToken);
		}
	}
}
