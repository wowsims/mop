import './MultiIconPicker.scss';

import { Menu } from '@base-ui/react/menu';
import { isRightClick } from '@domain/env';
import type { Player } from '@domain/player';
import type { ActionId } from '@domain/proto_utils/action_id';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { IconPicker } from '@ui-kit/IconPicker';
import type { MultiIconPickerConfig } from '@ui-kit/pickers/multi_icon_picker';
import { wowheadAnchorProps } from '@ui-kit/wowhead';
import clsx from 'clsx';
import { useId, useState } from 'react';

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
		if (value === 2 && input.improvedId) return input.improvedId;
		if (value === 3 && input.improvedId2) return input.improvedId2;
		return input.actionId;
	}
	return null;
};

export const MultiIconPicker = <ModObject,>({ modObject, config, subscribe, onClear }: MultiIconPickerProps<ModObject>) => {
	// `null` is the "not resolved yet" value Base UI waits on; anything else falls back to `<body>`.
	const [dropend, setDropend] = useState<HTMLDivElement | null>(null);

	const { actionId, hidden } = useStoreSubscribe(subscribe, () => ({
		actionId: firstActiveActionId(config, modObject),
		hidden: !!config.showWhen && !config.showWhen(modObject as unknown as Player<any>),
	}));

	const { iconUrl } = useActionId(config.categoryId ?? actionId ?? undefined);

	const labelId = useId();
	const groupProps = config.label ? { role: 'group', 'aria-labelledby': labelId } : {};

	return (
		<div className={clsx('multi-icon-picker-root', 'icon-picker', hidden && 'hide')} {...groupProps}>
			<div className="dropend" ref={setDropend}>
				<Menu.Root modal={false}>
					<Menu.Trigger
						nativeButton={false}
						render={<a />}
						openOnHover
						delay={0}
						className={clsx('icon-picker-button', actionId && 'active')}
						// The trigger is a bare anchor carrying a background image, so it announced nothing — and Base UI points the popup's `aria-labelledby` at it, which would have made the group nameless too.
						aria-label={config.label}
						{...wowheadAnchorProps({ icon: false })}
						style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
						onContextMenu={event => event.preventDefault()}
						onMouseDown={event => {
							if (isRightClick(event.nativeEvent)) onClear();
						}}
					/>
					<Menu.Portal container={dropend} keepMounted className="multi-icon-picker-portal">
						<Menu.Positioner side="right" align="start" sideOffset={-1} className="multi-icon-picker-positioner">
							{/* `role="group"`, not the `menu` Base UI would give it. A menu's children must be menuitems, and these are icon toggles — `Menu.Item` would close the popup on every click, and toggling several buffs in one visit is the whole point of this control. */}
							<Menu.Popup render={<ul />} role="group" className="multi-icon-picker-menu">
								<li>
									<a className="icon-dropdown-option dropdown-option" onClick={onClear} />
								</li>
								{config.inputs.map((input, index) => (
									<li key={index} className="icon-picker-option dropdown-option">
										<IconPicker modObject={modObject} config={input} />
									</li>
								))}
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>
			</div>
			{config.label && (
				<span className="multi-icon-picker-label form-label" id={labelId}>
					{config.label}
				</span>
			)}
		</div>
	);
};
