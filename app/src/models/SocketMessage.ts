export default interface SocketMessage<T extends string, D = any> {
	type: T;
	data: D;
}
