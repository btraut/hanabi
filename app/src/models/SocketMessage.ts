export default interface SocketMessage<T, D> {
	type: T;
	data: D;
}
