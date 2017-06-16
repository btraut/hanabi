import * as React from 'react';
import { ComponentBase } from 'resub';
import GoogleMapReact from 'google-map-react';

interface WeddingMapProps extends React.Props<WeddingMap> {}
interface WeddingMapState {}

import * as mapMarkerSVG from '../../public/images/map-marker-2.svg';

declare const GOOGLE_MAPS_API_KEY: string;

export default class WeddingMap extends ComponentBase<WeddingMapProps, WeddingMapState> {
	public render(): JSX.Element | null {
		const marker = React.createElement('div', {
			lat: 37.147368,
			lng: -121.970813,
			dangerouslySetInnerHTML: { __html: mapMarkerSVG },
			className: 'WeddingMap-Marker'
		});
		
		return (
			<GoogleMapReact
				bootstrapURLKeys={{
					key: GOOGLE_MAPS_API_KEY,
					language: 'en'
				}}
				center={{
					lat: 37.147368,
					lng: -121.970813
				}}
				zoom={ 9 }
				options={{
					scrollwheel: false,
					styles: [
						{
							featureType: 'administrative',
							elementType: 'labels.text.fill',
							stylers: [
								{
									color: '#444444'
								}
							]
						},
						{
							featureType: 'landscape',
							elementType: 'all',
							stylers: [
								{
									color: '#f2f2f2'
								}
							]
						},
						{
							featureType: 'poi',
							elementType: 'all',
							stylers: [
								{
									visibility: 'off'
								}
							]
						},
						{
							featureType: 'road',
							elementType: 'all',
							stylers: [
								{
									saturation: -100
								},
								{
									lightness: 45
								}
							]
						},
						{
							featureType: 'road.highway',
							elementType: 'all',
							stylers: [
								{
									visibility: 'simplified'
								}
							]
						},
						{
							featureType: 'road.arterial',
							elementType: 'labels.icon',
							stylers: [
								{
									visibility: 'off'
								}
							]
						},
						{
							featureType: 'transit',
							elementType: 'all',
							stylers: [
								{
									visibility: 'off'
								}
							]
						},
						{
							featureType: 'water',
							elementType: 'all',
							stylers: [
								{
									color: '#46bcec'
								},
								{
									visibility: 'on'
								}
							]
						}
					]
				}}
			>{ marker }</GoogleMapReact>
		);
	}
}
