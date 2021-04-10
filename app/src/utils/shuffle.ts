import seedrandom from 'seedrandom';

export function shuffleInPlace<T>(array: T[], seed: string | undefined = undefined): T[] {
	let currentIndex = array.length;
	let temporaryValue;
	let randomIndex;

	const rng = seedrandom(seed);

	// While there remain elements to shuffle...
	while (0 !== currentIndex) {
		// pick a remaining element...
		randomIndex = Math.floor(rng() * currentIndex);
		currentIndex -= 1;

		// and swap it with the current element.
		temporaryValue = array[currentIndex];
		array[currentIndex] = array[randomIndex];
		array[randomIndex] = temporaryValue;
	}

	return array;
}

export function shuffle<T>(array: T[], seed: string | undefined = undefined): T[] {
	const newArray = [...array];
	shuffleInPlace(newArray, seed);
	return newArray;
}
