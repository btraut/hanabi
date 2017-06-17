import * as React from 'react';
import { ComponentBase } from 'resub';
import * as documentOffset from 'document-offset';

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
	
	public render(): JSX.Element | null {
		const classes = ['ParallaxImage', ...this.props.className.split(' ')];
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
		if (!this._image.parentElement) {
			return;
		}
		
		const parentTop = documentOffset(this._image.parentElement).top as number;
		
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		
		const scrollTopStartPoint = parentTop - viewportHeight;
		const scrollTopEndPoint = parentTop + this._image.parentElement.clientHeight;
		
		const scrollTop = document.body.scrollTop;
		let scrollProgress = 0;
		
		if (scrollTop >= scrollTopStartPoint && scrollTop <= scrollTopEndPoint) {
			scrollProgress = -(scrollTopStartPoint - scrollTop) / (scrollTopEndPoint - scrollTopStartPoint);
		}
		
		const travel = this.props.travel || 200;
		const offset = this.props.offset || 0;
		
		this._image.style.transform = `translateY(${ (travel * scrollProgress) + (offset - travel) }px)`;
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
		
		this._image.style.width = splashImageWidth + 'px';
		this._image.style.height = splashImageHeight + 'px';
		this._image.style.left = ((splashImageWidth - parentWidth) / -2) + 'px';
	}
}
