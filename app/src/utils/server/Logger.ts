import { createLogger, format, transports } from 'winston';

class Logger {
	private _logger: any;

	public init() {
		this._logger = createLogger({
			level: 'silly',
			format: format.printf((info: any) => {
				return `${info.level}: ${info.message}`;
			}),
			transports: new transports.Console({ level: 'silly' }),
		});
	}

	public error(...args: any[]) {
		this._logger.error(...args);
	}

	public warn(...args: any[]) {
		this._logger.warn(...args);
	}

	public info(...args: any[]) {
		this._logger.info(...args);
	}

	public debug(...args: any[]) {
		this._logger.debug(...args);
	}
}

const instance = new Logger();
export default instance;
