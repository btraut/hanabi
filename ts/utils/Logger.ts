import * as winston from 'winston';

class Logger {
	private _logger: winston.LoggerInstance;
	
	public init() {
		this._logger = new winston.Logger();
		
		this._logger.add(winston.transports.Console, {
			level: 'silly'
		});
	}
	
	public error(...args: any[]) {
		this._logger.error.apply(this._logger, args);
	}
	
	public warn(...args: any[]) {
		this._logger.warn.apply(this._logger, args);
	}
	
	public info(...args: any[]) {
		this._logger.info.apply(this._logger, args);
	}
	
	public debug(...args: any[]) {
		this._logger.debug.apply(this._logger, args);
	}
}

const instance = new Logger();
export default instance;
