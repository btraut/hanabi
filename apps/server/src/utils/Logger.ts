import { createLogger, format, transports } from 'winston';

class Logger {
	private _logger: ReturnType<typeof createLogger> | null = null;

	public init() {
		this._logger = createLogger({
			level: 'silly',
			format: format.printf((info) => {
				return `${info.level}: ${info.message}`;
			}),
			transports: new transports.Console({ level: 'silly' }),
		});
	}

	public error(...args: unknown[]) {
		this._logger?.error(args.map(String).join(' '));
	}

	public warn(...args: unknown[]) {
		this._logger?.warn(args.map(String).join(' '));
	}

	public info(...args: unknown[]) {
		this._logger?.info(args.map(String).join(' '));
	}

	public debug(...args: unknown[]) {
		this._logger?.debug(args.map(String).join(' '));
	}
}

const instance = new Logger();
export default instance;
