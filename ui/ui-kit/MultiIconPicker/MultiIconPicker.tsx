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
	/**
	 * What re-reads the button image and `showWhen`. Vanilla hard-coded `subscribeSimChange(sim)`,
	 * which `ui-kit` cannot reach for — a generic picker's source is the caller's business.
	 */
	subscribe: StoreSubscribe;
	/**
	 * Zeroes every child input in one batch. A store write, so it lives in the feature's `model/`
	 * rather than here; both the right-click on the button and the blank option call it.
	 */
	onClear: () => void;
}

/**
 * `MultiIconPicker.getMaxValue()`: the first child that is switched on, read straight from the
 * source the way `IconPicker.getActionId()` does — during a write the child's own state may not have
 * caught up yet.
 */
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

/**
 * The dropdown that bundles several `IconPicker`s behind one button — the shape Buffs and Debuffs
 * use for a group of mutually-informative toggles (five ways to get Attack Power, say).
 *
 * It parameterises the option list, the label and the button's category icon; it fixes the popup's
 * markup and that clicking inside it keeps it open, which is the whole point — a visit toggles
 * several buffs.
 *
 * On Base UI's `Menu`, so the popup is a `Menu.Popup` rendered as the `<ul>` vanilla built inline.
 * Three things about that are deliberate:
 *
 * - **`openOnHover` with `delay={0}`** is what `shared/bootstrap_overrides.ts` did on top of
 *   Bootstrap from a capturing `mouseover` on `body`, since this picker sets no `data-bs-trigger`.
 *   The React button carries no `data-bs-toggle`, so that listener no longer sees it.
 * - **Nothing inside the popup is a `Menu.Item`.** An item closes the menu on click, and vanilla
 *   suppressed `hide.bs.dropdown` for any event carrying a `clickEvent` precisely so it would not.
 * - **`keepMounted` with the `.dropend` as the portal container.** Vanilla's `<ul>` is in the
 *   settings pane whether or not the menu is open, and the child pickers inside it are live
 *   subscribers from construction; a popup that mounted on open would change both.
 */
export const MultiIconPicker = <ModObject,>({ modObject, config, subscribe, onClear }: MultiIconPickerProps<ModObject>) => {
	// The portal renders into the `.dropend` div, which does not exist on the first pass. `null` is
	// the "not resolved yet" value Base UI waits on; anything else falls back to `<body>`.
	const [dropend, setDropend] = useState<HTMLDivElement | null>(null);

	// One object per notification, so a sim change that leaves the icon alone still re-renders — the
	// vanilla component ran `updateButtonImage()` and the `showWhen` toggle on every one of them.
	const { actionId, hidden } = useStoreSubscribe(subscribe, () => ({
		actionId: firstActiveActionId(config, modObject),
		// `makeMultiIconInput` builds this predicate out of the child inputs' own `showWhen`s and
		// casts its argument to the modObject, so the modObject is what it wants. Vanilla reached for
		// `sim.raid.getPlayer(0)` to get the same object.
		hidden: !!config.showWhen && !config.showWhen(modObject as unknown as Player<any>),
	}));

	const { iconUrl } = useActionId(config.categoryId ?? actionId ?? undefined);

	const labelId = useId();
	const groupProps = config.label ? { role: 'group', 'aria-labelledby': labelId } : {};

	return (
		<div className={clsx('multi-icon-picker-root', 'icon-picker', hidden && 'hide')} {...groupProps}>
			<div className="dropend" ref={setDropend}>
				{/* A dropdown is not a modal surface, and Bootstrap's was not one either. */}
				<Menu.Root modal={false}>
					<Menu.Trigger
						nativeButton={false}
						render={<a />}
						openOnHover
						delay={0}
						className={clsx('icon-picker-button', actionId && 'active')}
						// The trigger is a bare anchor carrying a background image, so it announced nothing
						// — and Base UI points the popup's `aria-labelledby` at it, which would have made
						// the group nameless too. Naming it fixes both.
						aria-label={config.label}
						{...wowheadAnchorProps({ icon: false })}
						// `fillAndSetActionId(id, elem, false, true)` — background only. The vanilla
						// button never carries an `href`, which is why the settings gate keys these
						// rows on their label rather than on a wowhead action.
						style={iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined}
						onContextMenu={event => event.preventDefault()}
						onMouseDown={event => {
							if (isRightClick(event.nativeEvent)) onClear();
						}}
					/>
					<Menu.Portal container={dropend} keepMounted className="multi-icon-picker-portal">
						{/* Bootstrap's `.dropend` put the menu to the right, top-aligned, and
						    `bootstrap_overrides.ts` set the plugin's offset to [0, -1] — measured as a
						    1px overlap of the button's right border. */}
						<Menu.Positioner side="right" align="start" sideOffset={-1} className="multi-icon-picker-positioner">
							{/* `role="group"`, not the `menu` Base UI would give it. A menu's children must be
							    menuitems, and these are icon toggles — `Menu.Item` would close the popup on
							    every click, and toggling several buffs in one visit is the whole point of
							    this control. So the popup keeps the behaviour and drops the role that would
							    be lying about it. Vanilla had no roles here at all. The name comes from Base
							    UI's `aria-labelledby`, which points at the trigger. */}
							<Menu.Popup render={<ul />} role="group" className="multi-icon-picker-menu">
								<li>
									{/* The blank "clear" option. An anchor with no `href`, as vanilla built it. */}
									<a className="icon-dropdown-option dropdown-option" onClick={onClear} />
								</li>
								{config.inputs.map((input, index) => (
									// The list comes from a module-level constant and never reorders, and the
									// configs carry no id of their own, so the index is the key.
									<li key={index} className="icon-picker-option dropdown-option">
										<IconPicker modObject={modObject} config={input} />
									</li>
								))}
							</Menu.Popup>
						</Menu.Positioner>
					</Menu.Portal>
				</Menu.Root>
			</div>
			{/* Vanilla removes the label element entirely when the config names none. A `<label>` that
			    labels nothing is not a label: this names the icon group, so the root carries
			    role=group + aria-labelledby and this is a span. */}
			{config.label && (
				<span className="multi-icon-picker-label form-label" id={labelId}>
					{config.label}
				</span>
			)}
		</div>
	);
};
