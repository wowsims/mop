import { ActionId } from '@sim/proto/action_id';
import { useActionId } from '@ui-kit/hooks/useActionId';
import clsx from 'clsx';

export interface UnitIconProps {
	/** A `UnitValue.iconUrl`: an `ActionId` to resolve, a Font Awesome glyph name, or a plain image url. */
	iconUrl: string | ActionId;
}

/** The three shapes a `UnitValue` icon takes, as one element. */
export const UnitIcon = ({ iconUrl }: UnitIconProps) => {
	const { iconUrl: resolved } = useActionId(iconUrl instanceof ActionId ? iconUrl : undefined);

	if (iconUrl instanceof ActionId) return <img className="unit-picker-item-icon" src={resolved || undefined} alt="" />;
	if (iconUrl.startsWith('fa-')) return <i className={clsx('fa', iconUrl, 'unit-picker-item-icon')} />;
	return <img className="unit-picker-item-icon" src={iconUrl} alt="" />;
};
