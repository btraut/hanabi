export type PubSubHandler<T> = (data: T) => void;
export type PubSubToken = number;

export default class PubSub<T> {
	private _subscriptions: { [token: string]: PubSubHandler<T> } = {};
	private _nonce = 0;

	public subscribe(handler: PubSubHandler<T>): number {
		const nonce = this._nonce;
		this._nonce += 1;

		this._subscriptions[nonce] = handler;

		return nonce;
	}

	public unsubscribe(nonce: number): void {
		delete this._subscriptions[nonce];
	}

	public unsubscribeAll(): void {
		this._subscriptions = {};
	}

	public emit(data: T): void {
		for (const subscription of Object.values(this._subscriptions)) {
			subscription(data);
		}
	}
}
