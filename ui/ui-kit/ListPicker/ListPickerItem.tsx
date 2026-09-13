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
	const enterCount = useRef(0);

	const [armed, setArmed] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [dragOver, setDragOver] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [headerElem, setHeaderElem] = useState<HTMLDivElement | null>(null);

	const hasActions = canDelete || canCopy || !!extraActions?.length;

	// Only the one or two items actually painting subscribe, so nothing walks the DOM and React's
	// diff stays authoritative.
	useEffect(() => {
		if (!dragging && !dragOver && !armed) return;
		return subscribeDragEnd(() => {
			setDragging(false);
			setDragOver(false);
			setArmed(false);
		});
	}, [dragging, dragOver, armed]);

	// The listener is consulted between a mousedown and the drag that may not start, so it is
	// bound only while armed.
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

	const menu = hasActions && (
		<ListItemPopover open={menuOpen} onOpenChange={setMenuOpen} container={headerElem}>
			{canDelete && (
				<ListItemAction
					icon="fa-times"
					className={['list-picker-item-delete', 'link-danger']}
					tooltip={deleteTooltip}
					tooltipId={tooltipId}
					onClick={() => {
						closeMenu();
						onDelete(index);
					}}
				/>
			)}
			{extraActions
				?.filter(extraAction => extraAction.shouldShow?.(index) ?? true)
				.map(extraAction => (
					<ListItemAction
						key={extraAction.className}
						icon={extraAction.icon}
						className={extraAction.className}
						tooltip={extraAction.tooltip}
						tooltipId={tooltipId}
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
					onClick={() => {
						closeMenu();
						onCopy(index);
					}}
				/>
			)}
		</ListItemPopover>
	);

	const heading = title !== undefined && <h6 className="list-picker-item-title">{title}</h6>;

	const itemHeader = (
		<div ref={setHeaderElem} className="list-picker-item-header">
			{heading}
			{header}
			{menu}
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
