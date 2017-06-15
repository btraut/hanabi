import * as React from 'react';
import { ComponentBase } from 'resub';

import ScrollUtils from '../utils/ScrollUtils';

import * as ampersandSVG from '../../public/images/ampersand.svg';

const SPLASH_IAMGE_EXTRA_HEIGHT = 200;
const SPLASH_IMAGE_WIDTH = 2000;
const SPLASH_IMAGE_HEIGHT = 1348;
const SPLASH_IMAGE_RATIO = SPLASH_IMAGE_WIDTH / SPLASH_IMAGE_HEIGHT;

interface HomePageProps extends React.Props<HomePage> {}
interface HomePageState {}

export default class HomePage extends ComponentBase<HomePageProps, HomePageState> {
	private _splashSection: HTMLElement;
	private _splashImage: HTMLElement;
	private _headerContainer: HTMLElement;
	private _downArrow: HTMLElement;
	
	public static getScripts() {
		return ['/js/home.js'];
	}
	
	public render(): JSX.Element | null {
		return (
			<div className="HomePage">
				<section className="HomePage-SplashSection" ref={ (ele) => { this._splashSection = ele; } }>
					<div className="HomePage-HeaderContainer" ref={ (ele) => { this._headerContainer = ele; } }>
						<h2 className="HomePage-SplashDate">May 19, 2018</h2>
						<h1 className="HomePage-Header">
							<div className="HomePage-HeaderName HomePage-HeaderName-Mary">Mary</div>
							<div className="HomePage-HeaderAmpersand" dangerouslySetInnerHTML={{ __html: ampersandSVG }} />
							<div className="HomePage-HeaderName HomePage-HeaderName-Brent">Brent</div>
						</h1>
					</div>
					<button className="HomePage-DownArrow" ref={ (ele) => { this._downArrow = ele; } } onClick={ this._handleDownArrowClick } />
					<div className="HomePage-SplashImage" ref={ (ele) => { this._splashImage = ele; } } />
				</section>
			</div>
		);
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
	
	private _handleScroll = () => {
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		const scrollProgress = Math.min(document.body.scrollTop, viewportHeight) / viewportHeight;
		
		this._splashImage.style.transform = `translateY(${ (SPLASH_IAMGE_EXTRA_HEIGHT * scrollProgress) - 10 }px)`;
		this._headerContainer.style.transform = `translate(-50%, calc(-50% - ${ (200 * scrollProgress) }px))`;
		this._downArrow.style.opacity = String(Math.max(1 - 2.5 * scrollProgress, 0));
	}
	
	private _handleResize = () => {
		this._resizeSections();
	}
	
	private _resizeSections() {
		const viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		
		this._splashSection.style.width = viewportWidth + 'px';
		this._splashSection.style.height = viewportHeight + 'px';
		
		// Update the splash image.
		let splashImageWidth = (viewportHeight + SPLASH_IAMGE_EXTRA_HEIGHT) * SPLASH_IMAGE_RATIO;
		let splashImageHeight = viewportHeight + SPLASH_IAMGE_EXTRA_HEIGHT;
		
		if ((viewportHeight + SPLASH_IAMGE_EXTRA_HEIGHT) * SPLASH_IMAGE_RATIO < viewportWidth) {
			splashImageWidth = viewportWidth;
			splashImageHeight = viewportWidth / SPLASH_IMAGE_RATIO;
		}
		
		this._splashImage.style.width = splashImageWidth + 'px';
		this._splashImage.style.height = splashImageHeight + 'px';
		this._splashImage.style.left = ((splashImageWidth - viewportWidth) / -2) + 'px';
	}
	
	private _handleDownArrowClick = () => {
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		ScrollUtils.scrollTo(0, viewportHeight, 1000);
	}
}
