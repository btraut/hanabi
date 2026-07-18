export const DEVELOPMENT_SESSION_COOKIE_SECRET = 'dev-secret';
export const PRODUCTION_SESSION_COOKIE_SECRET_MIN_LENGTH = 32;

const DOCUMENTED_PLACEHOLDERS = new Set(['replace-with-at-least-32-random-characters']);

export function assertValidProductionSessionSecret(nodeEnv: string, secret: string): void {
	if (
		nodeEnv === 'production' &&
		(secret.length < PRODUCTION_SESSION_COOKIE_SECRET_MIN_LENGTH ||
			DOCUMENTED_PLACEHOLDERS.has(secret))
	) {
		throw new Error(
			`SESSION_COOKIE_SECRET must be at least ${PRODUCTION_SESSION_COOKIE_SECRET_MIN_LENGTH} characters and must not use a documented placeholder in production.`,
		);
	}
}
