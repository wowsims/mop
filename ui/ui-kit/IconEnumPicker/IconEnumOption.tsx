import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import type { IconEnumValueConfig } from '@ui-kit/pickers/icon_enum_picker';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import { wowheadAnchorProps } from '@ui-kit/wowhead';
import clsx from 'clsx';

import { iconStyleOf } from './utils';

export interface IconEnumOptionProps<ModObject, T> {
	valueConfig: IconEnumValueConfig<ModObject, T>;
	hidden: boolean;
	tooltipId?: string;
	onSelect: () => void;
}

export const IconEnumOption = <ModObject, T>({ valueConfig, hidden, tooltipId, onSelect }: IconEnumOptionProps<ModObject, T>) => {
	const { iconUrl, href } = useActionId(hidden ? undefined : valueConfig.actionId);

	return (
		<Menu.Item
			render={<li />}
			className={clsx('icon-dropdown-option', 'dropdown-option', hidden && 'hide')}
			onClick={event => {
				event.preventDefault();
				onSelect();
			}}>
			<a
				className="icon-picker-button"
				{...wowheadAnchorProps()}
				href={hidden ? undefined : href || undefined}
				style={hidden ? undefined : iconStyleOf(valueConfig, iconUrl)}
				{...tooltipAnchorProps(valueConfig.tooltip ? tooltipId : undefined, valueConfig.tooltip)}
			/>
		</Menu.Item>
	);
};
