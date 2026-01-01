export default class PubSub {
    _subscriptions = {};
    _nonce = 0;
    subscribe(handler) {
        const nonce = this._nonce;
        this._nonce += 1;
        this._subscriptions[nonce] = handler;
        return nonce;
    }
    unsubscribe(nonce) {
        delete this._subscriptions[nonce];
    }
    unsubscribeAll() {
        this._subscriptions = {};
    }
    emit(data) {
        for (const subscription of Object.values(this._subscriptions)) {
            subscription(data);
        }
    }
}
