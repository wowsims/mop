import clsx from 'clsx';
import { type DragEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { beginDrag, endDrag, getDrag, type ListDrag, subscribeDragEnd } from './drag_state';
import { ListItemAction } from './ListItemAction';
import { ListItemPopover } from './ListItemPopover';
import type { ListPickerExtraAction } from './types';
import { dropIndex, isInteractiveTarget, listItemClassName } from './utils';

export interface ListPickerItemProps {
	index: number;
	listId: string;
	itemLabel: string;
	inlineMenuBar?: boolean;
	/** The `list-picker-item-title` heading, rendered only when the menu bar is not inline. */
	title?: string;
	dragGroup?: string;
	sameGroupOnly?: boolean;
	/** Already resolved against `minimumItems` by the list. */
	canDelete: boolean;
	canCopy: boolean;
	canMove: boolean;
	extraActions?: Array<ListPickerExtraAction>;
	deleteTooltip: string;
	copyTooltip: string;
	tooltipId: string;
	onDelete: (index: number) => void;
	onCopy: (index: number) => void;
	/** Builds the payload this item puts on the drag. */
	makeDrag: (index: number, elem: HTMLElement) => ListDrag;
	/** Applies a drop of `drag` at `dstIndex` in this list. */
	onDrop: (drag: ListDrag, dstIndex: number) => void;
	header?: ReactNode;
	children?: ReactNode;
}

export const ListPickerItem = ({
	index,
	listId,
	itemLabel,
	inlineMenuBar,
	title,
	dragGroup,
	sameGroupOnly,
	canDelete,
	canCopy,
	canMove,
	extraActions,
	deleteTooltip,
	copyTooltip,
	tooltipId,
	onDelete,
	onCopy,
	makeDrag,
	onDrop,
	header,
	children,
}: ListPickerItemProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const popoverRef = useRef<HTMLDivElement>(null);
	const actionsRef = useRef<HTMLElement>(null);
	const enterCount = useRef(0);

	const [armed, setArmed] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [dragOver, setDragOver] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuHasOpened, setMenuHasOpened] = useState(false);
	const [hoveredAction, setHoveredAction] = useState<string | null>(null);

	const hasActions = canDelete || canCopy || !!extraActions?.length;

	// Vanilla stripped `.dragfrom,.dragto` off the whole document at the end of a drag, because the
	// item that painted it is not always the one whose handler runs last. Only the one or two items
	// actually painting subscribe, so nothing walks the DOM and React's diff stays authoritative.
	useEffect(() => {
		if (!dragging && !dragOver && !armed) return;
		return subscribeDragEnd(() => {
			setDragging(false);
			setDragOver(false);
			setArmed(false);
		});
	}, [dragging, dragOver, armed]);

	// Vanilla bound this on `document` once per item, permanently — 317 listeners on the largest
	// preset. It is only ever consulted between a mousedown and the drag it may not start.
	useEffect(() => {
		if (!armed) return;
		const onMouseUp = () => {
			if (!getDrag()) setArmed(false);
		};
		document.addEventListener('mouseup', onMouseUp);
		return () => document.removeEventListener('mouseup', onMouseUp);
	}, [armed]);

	const droppingOnOtherList = useCallback(() => {
		const drag = getDrag();
		if (!drag || drag.listId === listId) return false;
		if (!sameGroupOnly) return false;
		if (dragGroup && drag.dragGroup === dragGroup) return false;
		return true;
	}, [listId, sameGroupOnly, dragGroup]);

	const targetIsSelf = useCallback(() => {
		const drag = getDrag();
		return !!drag && drag.listId === listId && drag.index === index;
	}, [listId, index]);

	const targetIsChild = useCallback(() => {
		const drag = getDrag();
		return !!drag && !!containerRef.current && drag.elem.contains(containerRef.current);
	}, []);

	const invalidDropTarget = useCallback(
		(checkSelf = true) => {
			const drag = getDrag();
			// Only the same kind of list: Value onto Value, Action onto Action.
			if (!drag || drag.itemLabel !== itemLabel) return true;
			if (droppingOnOtherList()) return true;
			if (checkSelf && targetIsSelf()) return true;
			if (checkSelf && targetIsChild()) return true;
			return false;
		},
		[itemLabel, droppingOnOtherList, targetIsSelf, targetIsChild],
	);

	const onMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
		const container = containerRef.current;
		if (!container) return;
		const target = event.target as HTMLElement;
		// A mousedown inside a nested list arms that list's item, not this one.
		if (target.closest('.list-picker-item-container') !== container) return;
		if (isInteractiveTarget(target, container)) return;
		setArmed(true);
	};

	const onDragStart = (event: DragEvent<HTMLDivElement>) => {
		const container = containerRef.current;
		if (!container) return;
		if (getDrag()) return;
		if (event.target !== container) return;
		const rect = container.getBoundingClientRect();
		event.dataTransfer.setDragImage(container, 0, event.clientY - rect.top);
		event.dataTransfer.dropEffect = 'move';
		event.dataTransfer.effectAllowed = 'move';
		setDragging(true);
		beginDrag(makeDrag(index, container));
	};

	const onDragEnter = (event: DragEvent<HTMLDivElement>) => {
		if (invalidDropTarget()) return;
		event.stopPropagation();
		enterCount.current++;
		setDragOver(true);
	};

	const onDragLeave = (event: DragEvent<HTMLDivElement>) => {
		if (invalidDropTarget()) return;
		event.preventDefault();
		enterCount.current--;
		if (enterCount.current <= 0) setDragOver(false);
	};

	const onDragOver = (event: DragEvent<HTMLDivElement>) => {
		if (invalidDropTarget()) {
			if (droppingOnOtherList() || targetIsSelf()) event.dataTransfer.dropEffect = 'none';
			return;
		}
		event.dataTransfer.dropEffect = 'move';
		event.stopPropagation();
		event.preventDefault();
	};

	const onDragEnd = (event: DragEvent<HTMLDivElement>) => {
		// Unconditional, where vanilla reached the same state either through this handler's cleanup
		// or through the document-wide strip its `drop` had already run.
		setArmed(false);
		setDragging(false);
		if (invalidDropTarget(false)) return;
		event.stopPropagation();
		endDrag();
	};

	const onDropEvent = (event: DragEvent<HTMLDivElement>) => {
		const drag = getDrag();
		const container = containerRef.current;
		if (!drag || invalidDropTarget()) {
			if (targetIsSelf()) {
				event.stopPropagation();
				endDrag();
			}
			return;
		}
		event.stopPropagation();
		enterCount.current = 0;
		setDragOver(false);
		const rect = container!.getBoundingClientRect();
		onDrop(drag, dropIndex(index, event.clientY, rect));
		endDrag();
	};

	const closeMenu = () => setMenuOpen(false);
	// The anchor is taken from the event rather than a ref: vanilla measured the button's rect
	// inside its own `mouseover`, and that is the element the event already hands over.
	const openMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
		actionsRef.current = event.currentTarget;
		setMenuOpen(true);
		setMenuHasOpened(true);
	};

	const popover = (
		<ListItemPopover popoverRef={popoverRef} anchorRef={actionsRef} open={menuOpen} onClose={closeMenu}>
			{canDelete && (
				<ListItemAction
					icon="fa-times"
					className={['list-picker-item-delete', 'link-danger']}
					tooltip={deleteTooltip}
					tooltipId={tooltipId}
					hovered={hoveredAction === 'delete'}
					onHoverChange={hovered => setHoveredAction(hovered ? 'delete' : null)}
					onClick={() => {
						closeMenu();
						onDelete(index);
					}}
				/>
			)}
			{extraActions?.map(extraAction => (
				<ListItemAction
					key={extraAction.className}
					icon={extraAction.icon}
					className={extraAction.className}
					tooltip={extraAction.tooltip}
					tooltipId={tooltipId}
					hidden={menuHasOpened && extraAction.shouldShow ? !extraAction.shouldShow(index) : undefined}
					hovered={hoveredAction === extraAction.className}
					onHoverChange={hovered => setHoveredAction(hovered ? extraAction.className : null)}
					onClick={() => {
						extraAction.onClick(index);
						closeMenu();
					}}
				/>
			))}
			{canCopy && (
				<ListItemAction
					icon="fa-copy"
					className="list-picker-item-copy"
					tooltip={copyTooltip}
					tooltipId={tooltipId}
					hovered={hoveredAction === 'copy'}
					onHoverChange={hovered => setHoveredAction(hovered ? 'copy' : null)}
					onClick={() => {
						closeMenu();
						onCopy(index);
					}}
				/>
			)}
		</ListItemPopover>
	);

	const heading = title !== undefined && <h6 className="list-picker-item-title">{title}</h6>;
	const actionsButton = hasActions && <ListItemAction icon="fa-ellipsis" className="list-picker-item-actions" onMouseOver={openMenu} />;

	const itemHeader = (
		<div className="list-picker-item-header">
			{popover}
			{heading}
			{header}
			{actionsButton}
		</div>
	);
	const itemBody = <div className="list-picker-item">{children}</div>;

	return (
		<div
			ref={containerRef}
			className={clsx(
				'list-picker-item-container',
				inlineMenuBar && 'inline',
				canMove && 'draggable',
				canMove && itemLabel && listItemClassName(itemLabel),
				dragging && 'dragfrom',
				dragOver && 'dragto',
			)}
			draggable={canMove && armed ? true : undefined}
			onMouseDown={canMove ? onMouseDown : undefined}
			onDragStart={canMove ? onDragStart : undefined}
			onDragEnter={canMove ? onDragEnter : undefined}
			onDragLeave={canMove ? onDragLeave : undefined}
			onDragOver={canMove ? onDragOver : undefined}
			onDragEnd={canMove ? onDragEnd : undefined}
			onDrop={canMove ? onDropEvent : undefined}>
			{inlineMenuBar ? itemBody : itemHeader}
			{inlineMenuBar ? itemHeader : itemBody}
		</div>
	);
};
