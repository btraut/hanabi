import * as React from 'react';
import { ComponentBase } from 'resub';

import * as closeSVG from '../../public/images/lightbox-close.svg';
import * as nextSVG from '../../public/images/lightbox-next.svg';
import * as previousSVG from '../../public/images/lightbox-previous.svg';

export interface Album {
	id: string;
	name: string;
	photos: Photo[];
}

export interface PhotoSize {
	url: string;
	width: number;
	height: number;
}

export interface Photo {
	id: string;
	title: string;
	thumb: PhotoSize;
	large: PhotoSize;
}

interface LightboxProps extends React.Props<Lightbox> {
	album: Album;
	defaultDisplayedPhotoIndex?: number;
	
	className?: string;
	onClose?: (lightbox?: Lightbox) => void;
}
interface LightboxState {
	currentPhotoIndex: number;
	overlayHidden: boolean;
	animating: boolean;
	hidden: boolean;
}

export default class Lightbox extends ComponentBase<LightboxProps, LightboxState> {
	private _hideOverlayTimeoutToken: any;
	
	protected _buildState(props: LightboxProps, initialBuild: boolean): Partial<LightboxState> {
		const newState: Partial<LightboxState> = {};
		
		if (initialBuild || props !== this.props) {
			newState.overlayHidden = false;
			newState.currentPhotoIndex = props.defaultDisplayedPhotoIndex || 0;
			newState.hidden = true;
		}
		
		return newState;
	}
	
	public render(): JSX.Element | null {
		let classes = ['Lightbox'];
		if (this.props.className) {
			classes = [...classes, ...this.props.className.split(' ')];
		}
		if (this.state.hidden) {
			classes.push('Lightbox-Hidden');
		}
		
		const photoClasses = ['Lightbox-Photo'];
		if (this.state.animating) {
			photoClasses.push('Lightbox-Photo-Animating');
		}
		
		const overlayClasses = ['Lightbox-Overlay'];
		if (this.state.overlayHidden) {
			overlayClasses.push('Lightbox-Overlay-Hidden');
		}
		
		const currentPhotoIndex = this.state.currentPhotoIndex;
		const previousPhotoIndex = currentPhotoIndex === 0 ? this.props.album.photos.length - 1 : currentPhotoIndex - 1;
		const nextPhotoIndex = currentPhotoIndex + 1 >= this.props.album.photos.length ? 0 : currentPhotoIndex + 1;
		
		let title: JSX.Element | null = null;
		if (this.props.album.photos[currentPhotoIndex].title) {
			title = <p className="Lightbox-Title">{ this.props.album.photos[currentPhotoIndex].title }</p>;
		}
		
		return (
			<div className={ classes.join(' ') } onMouseMove={ this._handleLightboxMouseMove } onClick={ this._handleLightboxClick }>
				<div className="Lightbox-Photos">
					<div className={ [...photoClasses, 'Lightbox-Photo-OffScreen', 'Lightbox-Photo-OffScreenLeft'].join(' ') } key={ this.props.album.photos[previousPhotoIndex].id } style={{ backgroundImage: `url(${ this.props.album.photos[previousPhotoIndex].large.url })` }} />
					<div className={ photoClasses.join(' ') } key={ this.props.album.photos[currentPhotoIndex].id } style={{ backgroundImage: `url(${ this.props.album.photos[currentPhotoIndex].large.url })` }} />
					<div className={ [...photoClasses, 'Lightbox-Photo-OffScreen', 'Lightbox-Photo-OffScreenRight'].join(' ') } key={ this.props.album.photos[nextPhotoIndex].id } style={{ backgroundImage: `url(${ this.props.album.photos[nextPhotoIndex].large.url })` }} />
				</div>
				<div className={ overlayClasses.join(' ') }>
					{ title }
					<button className="Lightbox-Control Lightbox-Control-Previous" onClick={ this._handlePreviousButtonClick } dangerouslySetInnerHTML={{ __html: previousSVG }} />
					<button className="Lightbox-Control Lightbox-Control-Next" onClick={ this._handleNextButtonClick } dangerouslySetInnerHTML={{ __html: nextSVG }} />
					<button className="Lightbox-Control Lightbox-Control-Close" onClick={ this._handleCloseButtonClick } dangerouslySetInnerHTML={{ __html: closeSVG }} />
				</div>
			</div>
		);
	}
	
	public componentDidMount() {
		super.componentDidMount();
		
		document.body.addEventListener('keydown', this._handleBodyKeydown);
		
		this._resetOverlayTimeout();
		
		this.setState({ hidden: false });
	}
	
	public componentWillUnmount() {
		super.componentWillUnmount();
		
		document.body.removeEventListener('keydown', this._handleBodyKeydown);
	}
	
	private _handleLightboxClick = () => {
		this._resetOverlayTimeout();
	}
	
	private _handleLightboxMouseMove = () => {
		this._resetOverlayTimeout();
	}
	
	private _handleNextButtonClick = () => {
		this._resetOverlayTimeout();
		this._advanceToNextPhoto();
	}
	
	private _handlePreviousButtonClick = () => {
		this._resetOverlayTimeout();
		this._advanceToPreviousPhoto();
	}
	
	private _handleCloseButtonClick = () => {
		this._close();
	}
	
	private _handleBodyKeydown = (event: KeyboardEvent) => {
		if (event.which === 27 /* esc */) {
			this._close();
			event.preventDefault();
		} else if (event.which === 37 /* left arrow */) {
			this._advanceToPreviousPhoto();
			event.preventDefault();
		} else if (event.which === 39 /* right arrow */) {
			this._advanceToNextPhoto();
			event.preventDefault();
		}
		
		this._resetOverlayTimeout();
	}
	
	private _resetOverlayTimeout() {
		this.setState({ overlayHidden: false });
		
		if (typeof this._hideOverlayTimeoutToken === 'number') {
			clearTimeout(this._hideOverlayTimeoutToken);
		}
		
		this._hideOverlayTimeoutToken = setTimeout(() => {
			this.setState({ overlayHidden: true });
		}, 2000);
	}
	
	private _advanceToPreviousPhoto() {
		if (this.state.animating) {
			return;
		}
		
		const previousPhotoIndex = this.state.currentPhotoIndex === 0 ? this.props.album.photos.length - 1 : this.state.currentPhotoIndex - 1;
		this._transitionPhotos(previousPhotoIndex);
	}
	
	private _advanceToNextPhoto() {
		if (this.state.animating) {
			return;
		}
		
		const nextPhotoIndex = this.state.currentPhotoIndex + 1 >= this.props.album.photos.length ? 0 : this.state.currentPhotoIndex + 1;
		this._transitionPhotos(nextPhotoIndex);
	}
	
	private _transitionPhotos(index: number) {
		this.setState({
			currentPhotoIndex: index,
			animating: true
		}, () => {
			setTimeout(() => { this.setState({ animating: false }); }, 300);
		});
	}
	
	private _close() {
		this.setState({ hidden: true }, () => {
			setTimeout(() => {
				if (this.props.onClose) {
					this.props.onClose(this);
				}
			}, 200);
		});
	}
}
