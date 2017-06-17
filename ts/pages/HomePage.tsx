import * as React from 'react';
import { ComponentBase } from 'resub';
import * as aos from 'aos';

import CountdownTimer from '../components/CountdownTimer';
import ParallaxImage from '../components/ParallaxImage';
import ScrollUtils from '../utils/ScrollUtils';
import WeddingMap from '../components/WeddingMap';

import * as ampersandSVG from '../../public/images/ampersand.svg';

interface HomePageProps extends React.Props<HomePage> {}
interface HomePageState {}

export default class HomePage extends ComponentBase<HomePageProps, HomePageState> {
	private _splashImage: ParallaxImage;
	
	private _splashSection: HTMLElement;
	private _headerContainer: HTMLElement;
	private _downArrow: HTMLElement;
	
	public static getScripts() {
		return ['/js/home.js'];
	}
	
	public render(): JSX.Element | null {
		return (
			<div className="HomePage">
				<section className="HomePage-SplashSection" ref={ (ele) => { this._splashSection = ele; } }>
					<ParallaxImage width={ 2000 } height={ 1348 } offset={ -10 } className="HomePage-SplashImage" ref={ (ele) => { this._splashImage = ele; } } />
					<div className="HomePage-HeaderContainer" ref={ (ele) => { this._headerContainer = ele; } }>
						<h2 className="HomePage-SplashDate" data-aos="fade-up" data-aos-duration="1000">May 19, 2018</h2>
						<h1 className="HomePage-Header" data-aos="fade-up" data-aos-duration="1000">
							<div className="HomePage-HeaderName HomePage-HeaderName-Mary">Mary</div>
							<div className="HomePage-HeaderAmpersand" dangerouslySetInnerHTML={{ __html: ampersandSVG }} />
							<div className="HomePage-HeaderName HomePage-HeaderName-Brent">Brent</div>
						</h1>
					</div>
					<button className="HomePage-DownArrow" ref={ (ele) => { this._downArrow = ele; } } onClick={ this._handleDownArrowClick } />
				</section>
				
				<section className="HomePage-BioSection">
					<h3 className="HomePage-SectionHeader" data-aos="zoom-in">Bride and Groom</h3>
					<h4 className="HomePage-SectionSubheader" data-aos="zoom-in">Introducing the happy couple…</h4>
					<div className="HomePage-Bios">
						<div className="HomePage-Bio" data-aos="fade-up" data-aos-offset="200">
							<div className="HomePage-BioInner">
								<img className="HomePage-Instax" src="/images/instax-mary.png" />
								<p className="HomePage-BioTitle">Mary Do</p>
								<p className="HomePage-BioText">The better half of the relationship; Mary is a firecracker whose love of all things furry knows no end. Although born in Vietnam, she finds as much identity in being a Michigander both from childhood and later becoming a proud Wolverine. Equal parts nerd, athlete, and socialite, Mary bakes a mean cookie and secretly aspires to become a champion rock climber. Her level of confidence is only surpassed by her sarcasm, and both are just shy of mandating a safety label.</p>
							</div>
						</div>
						<div className="HomePage-Bio" data-aos="fade-up" data-aos-offset="200">
							<div className="HomePage-BioInner">
								<img className="HomePage-Instax" src="/images/instax-brent.png" />
								<p className="HomePage-BioTitle">Brent Traut</p>
								<p className="HomePage-BioText">The strength, the support, the foundation; Brent is the reason the relationship continues to build and grow to what it is today and what it will be 10 years from now. He’s clueless with girls but when it comes to Mary, he knows exactly what to say. Born and raised in Minnesota, he still pronounces bagel “baggul” and has the sweet tooth of a five-year-old. He’s a go-getter who’ll try anything and excel at most, especially when a little friendly competition is involved.</p>
							</div>
						</div>
					</div>
				</section>
				
				<section className="HomePage-CountdownTimerSection">
					<ParallaxImage width={ 1920 } height={ 1280 } offset={ -50 } className="HomePage-CountdownTimerImage" />
					<div className="HomePage-CountdownTimerSectionInner" data-aos="fade-in" data-aos-offset="200">
						<p className="HomePage-CountdownTimerHeader">We’ll say yes in…</p>
						<CountdownTimer endDate={ new Date('May 19, 2018 16:00:00') } />
					</div>
				</section>
				
				<section className="HomePage-MapSection">
					<WeddingMap />
				</section>
				
				<footer className="HomePage-Footer">
					<p className="HomePage-FooterHelp">Made in California with help from 🐶🐶🐱.</p>
				</footer>
			</div>
		);
	}
	
	protected _componentDidRender() {
		this._resizeSections();
		this._handleScroll();
		
		this._splashImage.update();
	}
	
	public componentDidMount() {
		super.componentDidMount();
		
		window.addEventListener('scroll', this._handleScroll);
		window.addEventListener('resize', this._handleResize);
		
		aos.init({
			duration: 600,
			easing: 'ease-in-out',
			once: true
		});
	}
	
	public componentWillUnmount() {
		super.componentWillUnmount();
		
		window.removeEventListener('scroll', this._handleScroll);
		window.removeEventListener('resize', this._handleResize);
	}
	
	private _handleScroll = () => {
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		const scrollProgress = Math.min(document.body.scrollTop, viewportHeight) / viewportHeight;
		
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
	}
	
	private _handleDownArrowClick = () => {
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		ScrollUtils.scrollTo(0, viewportHeight, 1000);
	}
}
