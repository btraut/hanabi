import { createLogger, format, transports } from 'winston';
import { randomUUID } from 'node:crypto';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

class Logger {
	private _logger: ReturnType<typeof createLogger> | null = null;

	public init(level: LogLevel = 'info') {
		this._logger?.close();
		this._logger = createLogger({
			level,
			defaultMeta: {
				serverInstanceId: randomUUID(),
				deploymentId: process.env.RAILWAY_DEPLOYMENT_ID,
			},
			format: format.combine(format.timestamp(), format.json()),
			transports: new transports.Console(),
		});
	}

	/** Fields must be explicit diagnostic metadata, never socket payloads or credentials. */
	public event(
		event: string,
		fields: Readonly<Record<string, unknown>> = {},
		level: LogLevel = 'info',
	): void {
		this._logger?.log({ ...fields, level, event, message: event });
	}

	public error(...args: unknown[]) {
		this._write('error', args);
	}

	public warn(...args: unknown[]) {
		this._write('warn', args);
	}

	public info(...args: unknown[]) {
		this._write('info', args);
	}

	public debug(...args: unknown[]) {
		this._write('debug', args);
	}

	private _write(level: LogLevel, args: unknown[]): void {
		const errors = args.filter((value): value is Error => value instanceof Error);
		this._logger?.log({
			level,
			message: args.map(String).join(' '),
			...(errors.length > 0 && {
				errors: errors.map(({ name, message, stack }) => ({ name, message, stack })),
			}),
		});
	}
}

const instance = new Logger();
export default instance;
