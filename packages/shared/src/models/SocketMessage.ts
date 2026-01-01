export interface SocketMessageBase {
	readonly scope: string;
	readonly type: string;
}

export interface SocketMessage<T extends string, D = any> extends SocketMessageBase {
	readonly type: T;
	readonly data: D;
}
