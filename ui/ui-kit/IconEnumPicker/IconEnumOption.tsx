import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';

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
		<li role="none" data-testid="icon-dropdown-option">
			<Menu.LinkItem
				closeOnClick
				className="ui-icon-picker-swatch filter-[opacity(0.7)] transition-none hover:filter-none"
				data-testid="icon-picker-button"
				onClick={event => {
					event.preventDefault();
					onSelect();
				}}
				{...wowheadAnchorProps()}
				href={href || undefined}
				style={iconStyleOf(valueConfig, iconUrl)}
				{...tooltipAnchorProps(valueConfig.tooltip ? tooltipId : undefined, valueConfig.tooltip)}
			/>
		</li>
	);
};
