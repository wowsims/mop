import { Button } from '@ui-kit/Button';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx, { type ClassValue } from 'clsx';
import type { MouseEvent } from 'react';

export interface ListItemActionProps {
	/** The Font Awesome glyph, e.g. `fa-times`. */
	icon: string;
	className?: ClassValue;
	/** Text for the list's one shared tooltip; the anchor carries it. */
	tooltip?: string;
	tooltipId?: string;
	/** Vanilla's `extraAction.shouldShow`, applied only once the menu has been opened. */
	hidden?: boolean;
	onClick?: () => void;
	onMouseOver?: (event: MouseEvent<HTMLButtonElement>) => void;
	/** The hover class vanilla added with a `mouseenter`/`mouseleave` pair per button. */
	onHoverChange?: (hovered: boolean) => void;
	hovered?: boolean;
}

/**
 * One round action button — vanilla's `ListPicker.makeActionElem`, which was a static returning a
 * detached `<button>` that six call sites appended by hand. It is a component here, so the class
 * list, the icon and the `type="button"` live in one place and the tooltip rides on the anchor
 * instead of a `tippy()` instance per button.
 */
export const ListItemAction = ({ icon, className, tooltip, tooltipId, hidden, onClick, onMouseOver, onHoverChange, hovered }: ListItemActionProps) => (
	<Button
		variant="unstyled"
		className={clsx('list-picker-item-action', className, hovered && 'hover')}
		style={hidden === undefined ? undefined : { display: hidden ? 'none' : undefined }}
		onClick={onClick}
		onMouseOver={onMouseOver}
		onMouseEnter={onHoverChange && (() => onHoverChange(true))}
		onMouseLeave={onHoverChange && (() => onHoverChange(false))}
		{...tooltipAnchorProps(tooltipId, tooltip)}>
		<i className={clsx('fa', 'fa-xl', icon)} />
	</Button>
);
