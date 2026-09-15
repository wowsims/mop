import { Button } from '@ui-kit/Button';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx, { type ClassValue } from 'clsx';

export interface ListItemActionProps {
	/** The Font Awesome glyph, e.g. `fa-times`. */
	icon: string;
	className?: ClassValue;
	testId?: string;
	/** Text for the list's one shared tooltip; the anchor carries it. */
	tooltip?: string;
	tooltipId?: string;
	hidden?: boolean;
	onClick?: () => void;
}

/**
 * One round action button: the class list, the icon and the `type="button"` live in one place and
 * the tooltip rides on the anchor.
 */
const testIdFor = (className: ClassValue | undefined): string => {
	const classes = Array.isArray(className) ? className : className ? [className] : [];
	const specific = classes.map(String).find(name => name.startsWith('list-picker'));
	return specific ?? 'list-picker-item-action';
};

export const ListItemAction = ({ icon, className, testId, tooltip, tooltipId, hidden, onClick }: ListItemActionProps) => (
	<Button
		variant="unstyled"
		className={clsx(className, 'ui-list-picker-item-action')}
		data-testid={testId ?? testIdFor(className)}
		style={hidden === undefined ? undefined : { display: hidden ? 'none' : undefined }}
		onClick={onClick}
		{...tooltipAnchorProps(tooltipId, tooltip)}>
		<i className={clsx('fa', 'fa-xl', icon)} />
	</Button>
);
