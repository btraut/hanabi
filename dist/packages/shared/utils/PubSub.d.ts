export type PubSubHandler<T> = (data: T) => void;
export type PubSubToken = number;
export default class PubSub<T> {
    private _subscriptions;
    private _nonce;
    subscribe(handler: PubSubHandler<T>): number;
    unsubscribe(nonce: number): void;
    unsubscribeAll(): void;
    emit(data: T): void;
}
//# sourceMappingURL=PubSub.d.ts.map