import * as React from 'react';
import { ComponentBase } from 'resub';

interface ParallaxImageProps extends React.Props<ParallaxImage> {
	width: number;
	height: number;
	offset?: number;
	travel?: number;
	className: string;
}
interface ParallaxImageState {}

export default class ParallaxImage extends ComponentBase<ParallaxImageProps, ParallaxImageState> {
	private _image: HTMLElement;
	
	private _newScrollTop = 0;
	private _waitingForNextAnimationFrame = false;
	
	public render(): JSX.Element | null {
		let classes = ['ParallaxImage'];
		if (this.props.className) {
			classes = [...classes, ...this.props.className.split(' ')];
		}
		
		return <div className={ classes.join(' ') } ref={ (ele) => { this._image = ele; } } />;
	}
	
	protected _componentDidRender() {
		this._resizeSections();
		this._handleScroll();
	}
	
	public componentDidMount() {
		super.componentDidMount();
		
		window.addEventListener('scroll', this._handleScroll);
		window.addEventListener('resize', this._handleResize);
	}
	
	public componentWillUnmount() {
		super.componentWillUnmount();
		
		window.removeEventListener('scroll', this._handleScroll);
		window.removeEventListener('resize', this._handleResize);
	}
	
	public update() {
		this._resizeSections();
		this._handleScroll();
	}
	
	private _handleScroll = () => {
		this._newScrollTop = document.body.scrollTop;
		
		if (!this._waitingForNextAnimationFrame) {
			this._waitingForNextAnimationFrame = true;
			window.requestAnimationFrame(this._updateParallax);
		}
	}
	
	private _updateParallax = () => {
		if (!this._image.parentElement) {
			return;
		}
		
		const parentTop = this._getDocumentOffset(this._image.parentElement).top as number;
		
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		
		const scrollTopStartPoint = parentTop - viewportHeight;
		const scrollTopEndPoint = parentTop + this._image.parentElement.clientHeight;
		
		const scrollTop = this._newScrollTop;
		let scrollProgress = 0;
		
		if (scrollTop >= scrollTopStartPoint && scrollTop <= scrollTopEndPoint) {
			scrollProgress = -(scrollTopStartPoint - scrollTop) / (scrollTopEndPoint - scrollTopStartPoint);
		}
		
		const travel = this.props.travel || 200;
		const offset = this.props.offset || 0;
		
		this._image.style.transform = `translate3d(0, ${ (travel * scrollProgress) + (offset - travel) }px, 0)`;
		
		this._waitingForNextAnimationFrame = false;
	}
	
	private _handleResize = () => {
		this._resizeSections();
	}
	
	private _resizeSections() {
		if (!this._image.parentElement) {
			return;
		}
		
		const travel = this.props.travel || 200;
		
		const parentWidth = this._image.parentElement.clientWidth || 0;
		const parentHeight = this._image.parentElement.clientHeight || 0;
		
		const imageRatio = this.props.width / this.props.height;
		
		let splashImageWidth = (parentHeight + travel) * imageRatio;
		let splashImageHeight = parentHeight + travel;
		
		if ((parentHeight + travel) * imageRatio < parentWidth) {
			splashImageWidth = parentWidth;
			splashImageHeight = parentWidth / imageRatio;
		}
		
		this._image.style.width = Math.floor(splashImageWidth) + 'px';
		this._image.style.height = Math.floor(splashImageHeight) + 'px';
		this._image.style.left = Math.floor((splashImageWidth - parentWidth) / -2) + 'px';
	}
	
	private _getDocumentOffset(elem: HTMLElement) {
		const box = elem.getBoundingClientRect();

		const body = document.body;
		const docEl = document.documentElement;

		const scrollTop = window.pageYOffset || docEl.scrollTop || body.scrollTop;
		const scrollLeft = window.pageXOffset || docEl.scrollLeft || body.scrollLeft;

		const clientTop = docEl.clientTop || body.clientTop || 0;
		const clientLeft = docEl.clientLeft || body.clientLeft || 0;

		const top  = box.top +  scrollTop - clientTop;
		const left = box.left + scrollLeft - clientLeft;

		return { top: Math.round(top), left: Math.round(left) };
	}
}
