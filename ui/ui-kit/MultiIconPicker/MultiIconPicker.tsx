import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { Player } from '@sim/player/player';
import type { ActionId } from '@sim/proto/action_id';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { IconPicker } from '@ui-kit/IconPicker';
import { Menu } from '@ui-kit/Menu';
import { isRightClick } from '@ui-kit/utils/dom';
import clsx from 'clsx';
import { type MouseEvent, useId } from 'react';

import { wowheadAnchorProps } from '../utils/wowhead';
import type { MultiIconPickerConfig } from './types';

export interface MultiIconPickerProps<ModObject> {
	modObject: ModObject;
	config: MultiIconPickerConfig<ModObject>;
	subscribe: StoreSubscribe;
	onClear: () => void;
}

const firstActiveActionId = <ModObject,>(config: MultiIconPickerConfig<ModObject>, modObject: ModObject): ActionId | null => {
	for (const input of config.inputs) {
		const value = Number(input.getValue(modObject));
		if (value === 0) continue;
		return input.actionId;
	}
	return null;
};

export const MultiIconPicker = <ModObject,>({ modObject, config, subscribe, onClear }: MultiIconPickerProps<ModObject>) => {
	const { actionId, hidden } = useStoreSubscribe(subscribe, () => ({
		actionId: firstActiveActionId(config, modObject),
		hidden: !!config.showWhen && !config.showWhen(modObject as unknown as Player<any>),
	}));

	const { iconUrl } = useActionId(config.categoryId ?? actionId ?? undefined);

	const labelId = useId();
	const groupProps = config.label ? { role: 'group', 'aria-labelledby': labelId } : {};

	if (hidden) return null;

	return (
		<div className="ui-icon-field" data-testid="multi-icon-picker-root" {...groupProps}>
			<div className="relative">
				<Menu
					surface="none"
					triggerRender={<a />}
					triggerProps={{
						nativeButton: false,
						openOnHover: true,
						delay: 0,
						className: clsx('ui-icon-picker-swatch', actionId ? 'filter-none' : 'grayscale'),
						'data-testid': 'multi-icon-picker-button',
						'data-active': actionId ? '' : undefined,
						// The trigger is a bare anchor carrying a background image, so it announced nothing — and Base UI points the popup's `aria-labelledby` at it, which would have made the group nameless too.
						'aria-label': config.label,
						...wowheadAnchorProps({ icon: false }),
						style: iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined,
						onContextMenu: (event: MouseEvent) => event.preventDefault(),
						onMouseDown: (event: MouseEvent) => {
							if (isRightClick(event.nativeEvent)) onClear();
						},
					}}
					side="right"
					align="start"
					sideOffset={-1}
					positionMethod="fixed"
					portalProps={{ 'data-testid': 'multi-icon-picker-portal' }}
					positionerProps={{ 'data-testid': 'multi-icon-picker-positioner' }}
					className="grid grid-flow-col border-0 bg-grey"
					// `role="group"`, not the `menu` Base UI would give it. A menu's children must be menuitems, and these are icon toggles — `Menu.Item` would close the popup on every click, and toggling several buffs in one visit is the whole point of this control.
					popupProps={{ role: 'group', 'data-testid': 'multi-icon-picker-menu' }}>
					<li>
						<a className="ui-icon-picker-swatch p-0 filter-[opacity(0.7)] hover:filter-none" data-testid="icon-dropdown-option" onClick={onClear} />
					</li>
					{config.inputs.map((input, index) => (
						<li key={index} className="opacity-70 hover:opacity-100">
							<IconPicker modObject={modObject} config={input} />
						</li>
					))}
				</Menu>
			</div>
			{config.label && (
				<span className="ui-field-label mb-0" data-testid="multi-icon-picker-label" id={labelId} title={config.label}>
					{config.label}
				</span>
			)}
		</div>
	);
};
