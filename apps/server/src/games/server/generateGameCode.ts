import { randomInt } from 'node:crypto';

const CODE_GENERATION_ALPHABET = '23456789abdegjkmnpqrvwxyz';
const CODE_GENERATION_LENGTH = 6;

export function generateGameCode(length = CODE_GENERATION_LENGTH): string {
	let code = '';

	for (let i = 0; i < length; i += 1) {
		code += CODE_GENERATION_ALPHABET.charAt(randomInt(CODE_GENERATION_ALPHABET.length));
	}

	return code;
}
