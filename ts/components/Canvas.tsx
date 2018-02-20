import * as React from 'react';

interface CanvasProps {
	brushColor?: string;
	lineWidth?: number;
	style?: object;
}

interface CanvasState {
	drawing: boolean;
	lastX: number;
	lastY: number;
}

export default class Canvas extends React.Component<CanvasProps, CanvasState> {
	private static _defaultStyle = {
		cursor: 'default',
		backgroundColor: '#f4f4f4',
		userSelect: 'none',
		width: '100%',
		height: '100%'
	};
	
	public static defaultProps: CanvasProps = {
		brushColor: '#000000',
		lineWidth: 4,
		style: {}
	}
	
	private _canvas: HTMLCanvasElement | null = null;
	private _context: CanvasRenderingContext2D | null = null;
	
	private _tempCanvas: HTMLCanvasElement | null = null;
	private _tempContext: CanvasRenderingContext2D | null = null;
	
	constructor(props: CanvasProps) {
		super(props);
		
		this.state = {
			drawing: false,
			lastX: 0,
			lastY: 0
		};
	}
	
	private _saveCanvasRef = (canvas: HTMLCanvasElement | null) => {
		if (canvas) {
			this._canvas = canvas;
			this._context = this._canvas.getContext('2d');
			
			this._updateCanvasSize();
		} else {
			this._canvas = null;
			this._context = null;
		}
	}
	
	public componentDidMount() {
		window.addEventListener('resize', this._handleWindowResize);
		this._updateCanvasSize();
	}
	
	public componentWillUnmount() {
		window.removeEventListener('resize', this._handleWindowResize);
	}
	
	private _handleWindowResize = () => {
		this._updateCanvasSize();
	}
	
	private _updateCanvasSize() {
		if (!this._canvas || !this._context) {
			return;
		}
		
		if (!this._tempCanvas) {
			this._tempCanvas = document.createElement('canvas');
			this._tempContext = this._tempCanvas.getContext('2d');
		}
		
		// Resize the temp canvas and copy the image.
		this._tempCanvas.width = this._canvas.width;
		this._tempCanvas.height = this._canvas.height;
		this._tempContext!.drawImage(this._canvas, 0, 0);
		
		// Resize the real canvas.
		this._canvas.width = this._canvas.offsetWidth;
		this._canvas.height = this._canvas.offsetHeight;
		
		console.log(this._canvas.offsetWidth, this._canvas.offsetHeight);
		
		// Restore the image to the real canvas.
		this._context.drawImage(this._tempCanvas, 0, 0);
	}
	
	private _handleTouchStart = (event: React.TouchEvent<HTMLCanvasElement>) => {
		if (!this._canvas || !this._context) {
			return;
		}
		
		const rect = this._canvas.getBoundingClientRect();
		this._context.beginPath();
		
		this.setState({
			lastX: event.targetTouches[0].pageX - rect.left,
			lastY: event.targetTouches[0].pageY - rect.top,
			drawing: true
		});
	}
	
	private _handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
		if (!this._canvas || !this._context) {
			return;
		}
		
		const rect = this._canvas.getBoundingClientRect();
		this._context.beginPath();

		this.setState({
			lastX: event.clientX - rect.left,
			lastY: event.clientY - rect.top,
			drawing: true
		});
	}
	
	private _handleTouchMove = (event: React.TouchEvent<HTMLCanvasElement>) => {
		const { drawing, lastX, lastY } = this.state;
		
		if (!this._canvas || !this._context || !drawing) {
			return;
		}
		
		const rect = this._canvas.getBoundingClientRect();
		
		const currentX = event.targetTouches[0].pageX - rect.left;
		const currentY = event.targetTouches[0].pageY - rect.top;
		
		this._draw(lastX, lastY, currentX, currentY);
		
		this.setState({
			lastX: currentX,
			lastY: currentY
		});
	}
	
	private _handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const { drawing, lastX, lastY } = this.state;
		
		if (!this._canvas || !this._context  || !drawing) {
			return;
		}
		
		const rect = this._canvas.getBoundingClientRect();
		const currentX = event.clientX - rect.left;
		const currentY = event.clientY - rect.top;

		this._draw(lastX, lastY, currentX, currentY);
		this.setState({
			lastX: currentX,
			lastY: currentY
		});
	}
	
	private _handleMouseUp = () => {
		this.setState({ drawing: false });
	}
	
	private _handleTouchEnd = () => {
		this.setState({ drawing: false });
	}
	
	private _handleMouseOut = () => {
		this.setState({ drawing: false });
	}
	
	private _draw(lX: number, lY: number, cX: number, cY: number) {
		if (!this._canvas || !this._context) {
			return;
		}
		
		const { brushColor, lineWidth } = this.props;
		
		this._context.strokeStyle = brushColor!;
		this._context.lineWidth = lineWidth!;
		
		this._context.moveTo(lX, lY);
		this._context.lineTo(cX, cY);
		this._context.stroke();
	}

	public resetCanvas() {
		if (!this._canvas || !this._context) {
			return;
		}
		
		const width = this._canvas.width;
		const height = this._canvas.height;
		
		this._context.clearRect(0, 0, width, height);
	}

	public render() {
		const { style: canvasStyle } = this.props;
		
		const style = {
			...Canvas._defaultStyle,
			...canvasStyle
		};
		
		return (
			<canvas
				ref={this._saveCanvasRef}
				style={style}
				onMouseDown={this._handleMouseDown}
				onTouchStart={this._handleTouchStart}
				onMouseMove={this._handleMouseMove}
				onTouchMove={this._handleTouchMove}
				onMouseUp={this._handleMouseUp}
				onTouchEnd={this._handleTouchEnd}
				onMouseOut={this._handleMouseOut}
			/>
		);
	}
}
