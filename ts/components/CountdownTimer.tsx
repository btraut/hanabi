import * as React from 'react';
import { ComponentBase } from 'resub';

interface CountdownTimerProps extends React.Props<CountdownTimer> {
	endDate: Date;
}
interface CountdownTimerState {
	remainingSeconds: number;
}

export default class CountdownTimer extends ComponentBase<CountdownTimerProps, CountdownTimerState> {
	private _interval?: number;
	
	protected _buildState(props: CountdownTimerProps, initialBuild: boolean): Partial<CountdownTimerState> {
		if (initialBuild || props !== this.props) {
			return {
				remainingSeconds: Math.floor((props.endDate.getTime() - new Date().getTime()) / 1000)
			};
		}
		
		return {};
	}
	
	public render(): JSX.Element | null {
		const days = Math.floor(this.state.remainingSeconds / (60 * 60 * 24));
		const hours = Math.floor((this.state.remainingSeconds % (60 * 60 * 24)) / (60 * 60));
		const minutes = Math.floor((this.state.remainingSeconds % (60 * 60)) / 60);
		const seconds = this.state.remainingSeconds % 60;
		
		return (
			<div className="CountdownTimer">
				<div className="CountdownTimer-Section">
					<div className="CountdownTimer-Number">{ days }</div>
					<div className="CountdownTimer-Label">{ days === 1 ? 'Day' : 'Days' }</div>
				</div>
				<div className="CountdownTimer-Section">
					<div className="CountdownTimer-Number">{ hours }</div>
					<div className="CountdownTimer-Label">{ hours === 1 ? 'Hour' : 'Hours' }</div>
				</div>
				<div className="CountdownTimer-Section">
					<div className="CountdownTimer-Number">{ minutes }</div>
					<div className="CountdownTimer-Label">{ minutes === 1 ? 'Min' : 'Mins' }</div>
				</div>
				<div className="CountdownTimer-Section">
					<div className="CountdownTimer-Number">{ seconds }</div>
					<div className="CountdownTimer-Label">{ seconds === 1 ? 'Sec' : 'Secs' }</div>
				</div>
			</div>
		);
	}
	
	public componentDidMount() {
		super.componentDidMount();
		
		this._interval = setInterval(this._handleTick, 1000) as any as number;
	}
	
	public componentWillUnmount() {
		super.componentWillUnmount();
		
		if (this._interval) {
			clearInterval(this._interval);
			delete this._interval;
		}
	}
	
	private _handleTick = () => {
		this.setState({
			remainingSeconds: Math.floor((this.props.endDate.getTime() - new Date().getTime()) / 1000)
		});
	}
}
