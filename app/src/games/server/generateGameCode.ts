const CODE_GENERATION_ALPHABET = '23456789abdegjkmnpqrvwxyz';
const CODE_GENERATION_LENGTH = 4;

export function generateGameCode(length = CODE_GENERATION_LENGTH): string {
	let code = '';

	for (let i = 0; i < length; i += 1) {
		code += CODE_GENERATION_ALPHABET.charAt(
			Math.floor(Math.random() * CODE_GENERATION_ALPHABET.length),
		);
	}

	this._code = code;
	return this._code;
}
