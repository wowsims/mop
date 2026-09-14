import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import { wowheadAnchorProps } from '../utils/wowhead';
import type { IconEnumValueConfig } from './types';
import { iconStyleOf } from './utils';

export interface IconEnumOptionProps<ModObject, T> {
	valueConfig: IconEnumValueConfig<ModObject, T>;
	hidden: boolean;
	tooltipId?: string;
	onSelect: () => void;
}

export const IconEnumOption = <ModObject, T>({ valueConfig, hidden, tooltipId, onSelect }: IconEnumOptionProps<ModObject, T>) => {
	const { iconUrl, href } = useActionId(hidden ? undefined : valueConfig.actionId);

	if (hidden) return null;

	return (
		<Menu.Item
			render={<li />}
			className={clsx('icon-dropdown-option', 'ui-icon-picker-swatch', 'p-0 [filter:opacity(0.7)] hover:filter-none')}
			data-testid="icon-dropdown-option"
			onClick={event => {
				event.preventDefault();
				onSelect();
			}}>
			<a
				className="icon-picker-button ui-icon-picker-swatch transition-none -m-px"
				data-testid="icon-picker-button"
				{...wowheadAnchorProps()}
				href={href || undefined}
				style={iconStyleOf(valueConfig, iconUrl)}
				{...tooltipAnchorProps(valueConfig.tooltip ? tooltipId : undefined, valueConfig.tooltip)}
			/>
		</Menu.Item>
	);
};
