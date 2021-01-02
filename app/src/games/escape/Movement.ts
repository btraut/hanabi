export interface Location {
	x: number;
	y: number;
}

export interface Size {
	width: number;
	height: number;
}

export enum Direction {
	Up,
	Down,
	Left,
	Right,
}

export function move({ x, y }: Location, direction: Direction): Location {
	switch (direction) {
		case Direction.Up:
			return { x, y: y - 1 };
		case Direction.Down:
			return { x, y: y + 1 };
		case Direction.Left:
			return { x: x - 1, y };
		case Direction.Right:
			return { x: x + 1, y };
	}
}

export function locationIsInBounds({ x, y }: Location, size: Size): boolean {
	return x >= 0 && x < size.width && y >= 0 && y < size.height;
}
