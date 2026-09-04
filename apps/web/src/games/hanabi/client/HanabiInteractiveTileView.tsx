import HanabiTileView from '~/games/hanabi/client/HanabiTileView';
import useTileDrag from '~/games/hanabi/client/useTileDrag';
import { HANABI_TILE_SIZE, HANABI_TILE_SIZE_SMALL, HanabiTile } from '@hanabi/shared';
import useFocusVisible from '~/utils/client/useFocusVisible';
import classNames from 'classnames';
import { HanabiTileHighlightTone } from '~/games/hanabi/client/HanabiHighlightContext';
import { useCallback, useEffect, useRef } from 'react';
import {
	HANABI_TILE_LONG_PRESS_DELAY_MS,
	hasHanabiTouchMoved,
} from '~/games/hanabi/client/HanabiTouchInteractions';

export enum TileViewSize {
	Regular = 'Regular',
	Small = 'Small',
}

interface Props {
	// Tile data:
	tile: HanabiTile;

	// Optionally hide the value of the tile.
	hidden?: boolean;
	ariaLabel?: string;

	// Control tile size including overall size and font size.
	size?: TileViewSize;
	dimensions?: { height: number; width: number };

	// Can the user drag this tile?
	draggable?: boolean;
	dragHighlight?: boolean;
	responsiveDragSurface?: boolean;

	// Optionally show dashed highlight lines around the edges.
	highlight?: boolean;
	highlightTone?: HanabiTileHighlightTone;

	// Optionally show a clue seal meaning there has been a clue given
	// for this tile. This only shows for hidden tiles.
	notesIndicator?: boolean;

	// Specify custom event handlers.
	onClick?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onMouseOver?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onMouseOut?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onMouseDown?: (event: React.MouseEvent<HTMLElement>, tileId: string) => void;
	onLongPress?: (element: HTMLElement, tileId: string) => void;

	// Give this rendered tile a stable identity across an action state update.
	viewTransitionName?: string;
}

export default function HanabiInteractiveTileView({
	tile,
	dimensions,
	hidden = false,
	ariaLabel,
	size = TileViewSize.Regular,
	onClick,
	onMouseOver,
	onMouseOut,
	onMouseDown,
	onLongPress,
	draggable = false,
	dragHighlight,
	responsiveDragSurface = false,
	highlight = false,
	highlightTone = 'action',
	notesIndicator = false,
	viewTransitionName,
}: Props): JSX.Element | null {
	const isFocusVisible = useFocusVisible();

	const cursor = draggable ? 'cursor-move' : onClick ? 'cursor-pointer' : 'cursor-default';

	const { isDragging, dragRef } = useTileDrag(
		tile.id,
		dragHighlight ?? highlight,
		highlightTone,
		notesIndicator,
		draggable,
		responsiveDragSurface,
	);
	const connectDragSource = useCallback(
		(element: HTMLElement | null) => {
			dragRef(element);
		},
		[dragRef],
	);
	const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const touchStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
	const suppressClickRef = useRef(false);
	const suppressClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const clearLongPressTimer = useCallback(() => {
		if (longPressTimerRef.current) {
			clearTimeout(longPressTimerRef.current);
			longPressTimerRef.current = null;
		}
	}, []);

	const clearClickSuppression = useCallback(() => {
		if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
		suppressClickTimerRef.current = null;
		suppressClickRef.current = false;
	}, []);

	const suppressNextClick = useCallback(() => {
		if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
		suppressClickTimerRef.current = null;
		suppressClickRef.current = true;
	}, []);

	const releaseClickSuppression = useCallback(() => {
		if (!suppressClickRef.current) return;
		if (suppressClickTimerRef.current) clearTimeout(suppressClickTimerRef.current);
		suppressClickTimerRef.current = setTimeout(() => {
			suppressClickRef.current = false;
			suppressClickTimerRef.current = null;
		}, 800);
	}, []);

	useEffect(
		() => () => {
			clearLongPressTimer();
			clearClickSuppression();
		},
		[clearClickSuppression, clearLongPressTimer],
	);

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (suppressClickRef.current && event.detail > 0) {
				clearClickSuppression();
				event.preventDefault();
				event.stopPropagation();
				return;
			}
			if (onClick) {
				onClick(event, tile.id);
			}
		},
		[clearClickSuppression, onClick, tile],
	);

	const handlePointerDown = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (event.pointerType !== 'touch' || !onLongPress) return;

			clearClickSuppression();
			clearLongPressTimer();
			touchStartRef.current = {
				pointerId: event.pointerId,
				x: event.clientX,
				y: event.clientY,
			};
			onMouseDown?.(event, tile.id);

			const element = event.currentTarget;
			if (event.nativeEvent.isTrusted) element.setPointerCapture?.(event.pointerId);
			longPressTimerRef.current = setTimeout(() => {
				longPressTimerRef.current = null;
				suppressNextClick();
				onLongPress(element, tile.id);
			}, HANABI_TILE_LONG_PRESS_DELAY_MS);
		},
		[
			clearClickSuppression,
			clearLongPressTimer,
			onLongPress,
			onMouseDown,
			suppressNextClick,
			tile.id,
		],
	);

	const handlePointerMove = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			const start = touchStartRef.current;
			if (!start || start.pointerId !== event.pointerId) return;
			if (!hasHanabiTouchMoved(start, { x: event.clientX, y: event.clientY })) return;

			clearLongPressTimer();
			suppressNextClick();
		},
		[clearLongPressTimer, suppressNextClick],
	);

	const handlePointerEnd = useCallback(
		(event: React.PointerEvent<HTMLElement>) => {
			if (touchStartRef.current?.pointerId !== event.pointerId) return;
			clearLongPressTimer();
			touchStartRef.current = null;
			releaseClickSuppression();
		},
		[clearLongPressTimer, releaseClickSuppression],
	);
	useEffect(() => {
		if (onLongPress) return;
		clearLongPressTimer();
		touchStartRef.current = null;
	}, [clearLongPressTimer, onLongPress]);
	const handleMouseOver = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (onMouseOver) {
				onMouseOver(event, tile.id);
			}
		},
		[onMouseOver, tile],
	);
	const handleMouseOut = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (onMouseOut) {
				onMouseOut(event, tile.id);
			}
		},
		[onMouseOut, tile],
	);

	const handleMouseDown = useCallback(
		(event: React.MouseEvent<HTMLElement>) => {
			if (suppressClickRef.current) {
				event.preventDefault();
				return;
			}
			if (onMouseDown) {
				onMouseDown(event, tile.id);
			}
		},
		[onMouseDown, tile],
	);

	const Comp = onClick ? 'button' : 'div';

	return (
		<Comp
			ref={connectDragSource}
			data-hanabi-tile-id={tile.id}
			style={{
				...(dimensions ??
					(size === TileViewSize.Regular ? HANABI_TILE_SIZE : HANABI_TILE_SIZE_SMALL)),
				WebkitTouchCallout: onLongPress ? 'none' : undefined,
			}}
			className={classNames([
				'rounded-lg focus:outline-none select-none',
				cursor,
				{
					'touch-none': draggable,
					'touch-manipulation': !draggable,
					'focus:ring': isFocusVisible,
					'focus:border-blue-800': isFocusVisible,
					'opacity-0': isDragging,
				},
			])}
			onClick={onClick ? handleClick : undefined}
			onMouseOver={onMouseOver ? handleMouseOver : undefined}
			onMouseOut={onMouseOut ? handleMouseOut : undefined}
			onMouseDown={onMouseDown ? handleMouseDown : undefined}
			onPointerDown={onLongPress ? handlePointerDown : undefined}
			onPointerMove={onLongPress ? handlePointerMove : undefined}
			onPointerUp={onLongPress ? handlePointerEnd : undefined}
			onPointerCancel={onLongPress ? handlePointerEnd : undefined}
			onContextMenu={
				onLongPress
					? (event) => {
							event.preventDefault();
						}
					: undefined
			}
			aria-label={ariaLabel}
		>
			<HanabiTileView
				color={hidden ? undefined : tile.color}
				dimensions={dimensions}
				number={hidden ? undefined : tile.number}
				highlight={highlight}
				highlightTone={highlightTone}
				notesIndicator={hidden && notesIndicator}
				size={size}
				viewTransitionName={viewTransitionName}
			/>
		</Comp>
	);
}
