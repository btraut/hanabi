import * as React from 'react';
import { ComponentBase } from 'resub';
import * as ReactPlayer from 'react-player';

import CountdownTimer from '../components/CountdownTimer';
import Lightbox from '../components/Lightbox';
import ParallaxImage from '../components/ParallaxImage';
import ResponsiveDesignStore, { ResponsiveSize } from '../stores/ResponsiveDesignStore';
import ScrollUtils from '../utils/ScrollUtils';
import WeddingMap from '../components/WeddingMap';

import EngagementShootAlbum from '../config/EngagementShootAlbum';
import NestldownAlbum from '../config/NestldownAlbum';

import * as ampersandSVG from '../../public/images/ampersand.svg';
import * as emailSVG from '../../public/images/email.svg';

interface HomePageProps extends React.Props<HomePage> {}
interface HomePageState {
	showVenueLightbox: number | null;
	showEngagementLightbox: number | null;
	
	responsiveSize: ResponsiveSize;
}

export default class HomePage extends ComponentBase<HomePageProps, HomePageState> {
	private _splashImage: ParallaxImage;
	
	private _container: HTMLElement;
	private _splashSection: HTMLElement;
	private _headerContainer: HTMLElement;
	private _downArrow: HTMLElement;
	
	private _newScrollTop = 0;
	private _waitingForNextAnimationFrame = false;
	
	protected _buildState(props: HomePageProps, initialBuild: boolean): Partial<HomePageState> {
		const newState: Partial<HomePageState> = {};
		
		if (initialBuild || props !== this.props) {
			newState.showVenueLightbox = null;
			newState.showEngagementLightbox = null;
		}
		
		newState.responsiveSize = ResponsiveDesignStore.getResponsiveSize();
		
		return newState;
	}
	
	public render(): JSX.Element | null {
		let lightbox: JSX.Element | null = null;
		if (this.state.showVenueLightbox !== null) {
			lightbox = <Lightbox album={ NestldownAlbum } defaultDisplayedPhotoIndex={ this.state.showVenueLightbox } onClose={ this._handleVenueLightboxClosed } />;
		} else if (this.state.showEngagementLightbox !== null) {
			lightbox = <Lightbox album={ EngagementShootAlbum } defaultDisplayedPhotoIndex={ this.state.showEngagementLightbox } onClose={ this._handleEngagementLightboxClosed } />;
		}
		
		const venuePhotosListItems = NestldownAlbum.photos.map((photo, index) => {
			return (
				<li className="HomePage-VenuePhotoListItem" key={ `VenuePhotoListItem-${ photo.id }` }>
					<div className="HomePage-VenuePhoto" style={{ backgroundImage: `url('${ photo.thumb.url }')` }} data-index={ index } onClick={ this._handleVenuePhotoClick } />
				</li>
			);
		});
		
		const engagementPhotosListItems = EngagementShootAlbum.photos.map((photo, index) => {
			return (
				<li className="HomePage-EngagementPhotoListItem" data-aos="fade-down" data-aos-delay={ index * 100 } key={ `VenuePhotoListItem-${ photo.id }` }>
					<img className="HomePage-EngagementPhoto" src={ photo.thumb.url } data-index={ index } onClick={ this._handleEngagementPhotoClick } />
				</li>
			);
		});
		
		let splashOffset = 0;
		switch (this.state.responsiveSize) {
		case ResponsiveSize.Giant: splashOffset = 0; break;
		case ResponsiveSize.Large: splashOffset = -100; break;
		case ResponsiveSize.Medium: splashOffset = -200; break;
		case ResponsiveSize.Small: splashOffset = -200; break;
		case ResponsiveSize.ExtraSmall: splashOffset = -280; break;
		}
		
		return (
			<div className="HomePage" ref={ (ele) => { this._container = ele; } }>
				<section className="HomePage-SplashSection" ref={ (ele) => { this._splashSection = ele; } }>
					<ParallaxImage width={ 2000 } height={ 1348 } offsetX={ splashOffset } offsetY={ -50 } className="HomePage-SplashImage" ref={ (ele) => { this._splashImage = ele; } } />
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
								<p className="HomePage-BioText">The better half of the relationship; Mary is a firecracker whose love of all things furry knows no end. Although born in Vietnam, she finds as much identity in being a Michigander from childhood through her time as a proud Wolverine. Equal parts nerd, athlete, and socialite, Mary bakes a mean cookie and secretly aspires to become a champion rock climber. Her level of confidence is only surpassed by her sarcasm, and both are just shy of mandating a safety label.</p>
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
				
				<section className="HomePage-EngagementPhotosSection">
					<ul className="HomePage-EngagementPhotoList">
						{ engagementPhotosListItems }
					</ul>
				</section>
				
				<section className="HomePage-EngagementSection">
					<h3 className="HomePage-SectionHeader" data-aos="zoom-in">The Engagement</h3>
					<h4 className="HomePage-SectionSubheader" data-aos="zoom-in">High atop Half Dome</h4>
					<div className="HomePage-EngagementVideo">
						<ReactPlayer url="https://vimeo.com/192174619" />
					</div>
				</section>
				
				<section className="HomePage-CountdownTimerSection">
					<ParallaxImage width={ 1920 } height={ 1280 } offsetY={ -50 } className="HomePage-CountdownTimerImage" />
					<div className="HomePage-CountdownTimerSectionInner" data-aos="fade-in" data-aos-offset="200">
						<p className="HomePage-CountdownTimerHeader">We’ll say yes in…</p>
						<CountdownTimer endDate={ new Date('May 19, 2018 16:00:00') } />
					</div>
				</section>
				
				<section className="HomePage-MapSection">
					<h3 className="HomePage-SectionHeader" data-aos="zoom-in">Event Details</h3>
					<h4 className="HomePage-SectionSubheader" data-aos="zoom-in">When & Where</h4>
					<div className="HomePage-Venue">
						<div className="HomePage-VenueDetails">
							<div className="HomePage-VenueDetailsInner" data-aos="fade-right">
								<p className="HomePage-VenueDetailsTitle">Nestldown</p>
								<p className="HomePage-VenueDetailsDate">May 19, 2018</p>
								<p className="HomePage-VenueDetailsTime">3:30pm</p>
								<p className="HomePage-VenueDetailsAddress">
									22420 Old Santa Cruz Highway <br />
									Los Gatos, CA 95030 <br />
									<a href="http://nestldown.com/Nestldown-map-&-directions.pdf" target="_blank">Directions</a>
								</p>
								<ul className="HomePage-VenuePhotoList">
									{ venuePhotosListItems }
								</ul>
							</div>
						</div>
						<div className="HomePage-MapContainer">
							<WeddingMap />
						</div>
					</div>
				</section>
				
				<section className="HomePage-ContactUsSection">
					<h3 className="HomePage-SectionHeader" data-aos="fade-left">Contact Us</h3>
					<h4 className="HomePage-SectionSubheader" data-aos="fade-left">Reach out</h4>
					<a className="HomePage-ContactUsButton" href="mailto:brent@traut.com,mary.do@me.com?subject=Whasssup!??!?" data-aos="fade-right">
						<i dangerouslySetInnerHTML={{ __html: emailSVG }} />
						<span>Email</span>
					</a>
					<p className="HomePage-PhoneNumbers" data-aos="fade-left">
						Mary: 248-520-0222<br />
						Brent: 320-223-0017
					</p>
				</section>
				
				<footer className="HomePage-Footer">
					<p className="HomePage-FooterHelp">Made in California with help from 🐶🐶🐱.</p>
				</footer>
				
				{ lightbox }
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
		
		this._initializeAOS();
	}
	
	private async _initializeAOS() {
		const aos = await import('aos');
		
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
	
	private _handleVenueLightboxClosed = () => {
		this.setState({ showVenueLightbox: null });
	};
	
	private _handleEngagementLightboxClosed = () => {
		this.setState({ showEngagementLightbox: null });
	};
	
	private _handleScroll = () => {
		this._newScrollTop = window.scrollY;
		
		if (!this._waitingForNextAnimationFrame) {
			this._waitingForNextAnimationFrame = true;
			window.requestAnimationFrame(this._updateScrollContent);
		}
	}
	
	private _updateScrollContent = () => {
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		const scrollProgress = Math.min(window.scrollY, viewportHeight) / viewportHeight;
		
		this._headerContainer.style.transform = `translate(-50%, calc(-50% - ${ Math.floor(200 * scrollProgress) }px))`;
		this._downArrow.style.opacity = String(Math.floor(Math.max(1 - 2.5 * scrollProgress, 0) * 100) / 100);
		
		this._waitingForNextAnimationFrame = false;
	}
	
	private _handleResize = () => {
		this._resizeSections();
	}
	
	private _resizeSections() {
		this._splashSection.style.width = document.body.clientWidth + 'px';
		this._splashSection.style.height = document.documentElement.clientHeight + 'px';
	}
	
	private _handleDownArrowClick = () => {
		const viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
		ScrollUtils.scrollTo(0, viewportHeight, 1000);
	}
	
	private _handleVenuePhotoClick = (event: React.MouseEvent<HTMLElement>) => {
		const index = parseInt(event.currentTarget.dataset.index!, 10);
		this.setState({ showVenueLightbox: index });
	}
	
	private _handleEngagementPhotoClick = (event: React.MouseEvent<HTMLElement>) => {
		const index = parseInt(event.currentTarget.dataset.index!, 10);
		this.setState({ showEngagementLightbox: index });
	}
}
