// PopupContainer.tsx
//
// PopupContainer wraps popup content. This will be inserted somewhere
// in the body when a popup is displayed.

import * as React from 'react';
import { ComponentBase } from 'resub';
import PopupStore from '../stores/PopupStore';

interface PopupContainerProps extends React.Props<PopupContainer> {
	readonly canClickOut: boolean;
}
interface PopupContainerState {}

export default class PopupContainer extends ComponentBase<PopupContainerProps, PopupContainerState> {
	public render(): JSX.Element | null {
		return (
			<div
				className="PopupContainer"
				onMouseDown={ this._onMaskClick.bind(this) }
				onTouchStart={ this._onMaskClick.bind(this) }
			>
				<div
					className="PopupContainer-content"
					onMouseDown={ this._onPopupClick.bind(this) }
					onTouchStart={ this._onPopupClick.bind(this) }
				>
					{ this.props.children }
				</div>
			</div>
		);
	}
	
	private _onPopupClick = (event: React.MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}
	
	private _onMaskClick = (event: React.MouseEvent<HTMLDivElement>) => {
		if (this.props.canClickOut) {
			PopupStore.popPopup();
		}
		
		event.stopPropagation();
		event.preventDefault();
	}
}
