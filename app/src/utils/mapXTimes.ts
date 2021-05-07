export default function mapXTimes<T>(x: number, iterator: (index: number) => T): T[] {
	const final: T[] = [];

	for (let i = 0; i < x; i++) {
		final.push(iterator(i));
	}

	return final;
}
