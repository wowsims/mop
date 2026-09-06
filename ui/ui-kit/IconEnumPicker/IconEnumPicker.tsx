import './IconEnumPicker.scss';

import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import { useInput } from '@ui-kit/hooks/useInput';
import { type IconEnumPickerConfig, IconEnumPickerDirection, type IconEnumValueConfig } from '@ui-kit/pickers/icon_enum_picker';
import { PickerShell } from '@ui-kit/PickerShell';
import { Tooltip } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useEffect, useId, useRef, useState } from 'react';

import { IconEnumOption } from './IconEnumOption';
import { actionIconStyle, iconEnumPickerShown, iconStyleOf } from './utils';

export interface IconEnumPickerProps<ModObject, T> {
	modObject: ModObject;
	config: IconEnumPickerConfig<ModObject, T>;
}

/**
 * The icon that opens a menu of icons and takes its picture from the one you choose: a mage's
 * armour, a hunter's pet, every consumable slot.
 *
 * It parameterises the value list and the button's zero value; it fixes the button-plus-menu markup
 * and that choosing an option closes the menu — which is the difference from `MultiIconPicker`, the
 * other Bootstrap dropdown on this adapter. There a visit toggles several buffs, so nothing in the
 * popup may be a `Menu.Item`; here an option *is* the choice, so every one of them is.
 *
 * On Base UI's `Menu`, and three things about that are deliberate:
 *
 * - **`openOnHover` with `delay={0}`.** `shared/bootstrap_overrides.ts` opened every
 *   `[data-bs-toggle=dropdown]` without a `data-bs-trigger` from a capturing `mouseover` on `body`,
 *   and this picker set none. The React button carries no `data-bs-toggle`, so that listener no
 *   longer sees it and the behaviour has to be asked for.
 * - **The popup is portalled into a slot element of our own** rather than straight into the root.
 *   `Menu.Portal` appends its element to the container in a later commit than React places the
 *   root's own children, so a portal aimed at the root lands *after* the trailing `<label>` — where
 *   vanilla's `<ul>` sits between the button and that label. The slot holds the place instead. It
 *   has to be inside the root either way: `.input-root.icon-enum-picker-root .icon-picker-button`
 *   is what gives every anchor here `filter: none`, and a popup portalled to `<body>` would leave
 *   the options out of the settings pane that two gates read them from.
 * - **`keepMounted`.** Vanilla's `<ul>` and every option in it exist from construction, subscribed
 *   to the source; a popup that mounted on open would change both, and the settings gate reads the
 *   options' `hide` classes without ever opening a menu.
 */
export const IconEnumPicker = <ModObject, T>({ modObject, config }: IconEnumPickerProps<ModObject, T>) => {
	// The portal renders into the slot below, which does not exist on the first pass. `null` is the
	// "not resolved yet" value Base UI waits on; anything else falls back to `<body>`.
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
	const { value, setValue, disabled, revision } = useInput(modObject, config);
	const tooltipId = useId();

	// `showValueWhen()` also tests `!actionId || actionId != null`, which is true whichever way the
	// actionId goes, so the option's own `showWhen` is all of it.
	const shows = (valueConfig: IconEnumValueConfig<ModObject, T>) => !valueConfig.showWhen || valueConfig.showWhen(modObject);

	// `showWhen()` is overridden on the vanilla picker, so `useInput`'s own `hidden` is not the whole
	// answer and is not read. The override lives in `utils` because the consumes rows need it too.
	const hidden = !iconEnumPickerShown(config, modObject);

	const selected = config.values.find(valueConfig => config.equals(valueConfig.value, value));
	const selectedHidden = !!selected && !shows(selected);
	// `backupIconUrl` fills the button for a value the list does not carry — a cooldown the player no
	// longer has, in the only config that sets it.
	const backupId = selected ? undefined : config.backupIconUrl?.(value);
	const { iconUrl, href } = useActionId(selectedHidden ? undefined : (selected?.actionId ?? backupId));

	// `setActive(this.enabled && …)`. The backup branch's own `setActive(false)` is dead: `refresh()`
	// and `init()` both call `update()` straight after `setInputValue`, and `update()` recomputes this.
	const active = !disabled && !config.equals(value, config.zeroValue);

	// storeValue()/restoreValue(), plus the zeroing `updateOption` does — all three are driven by the
	// source subscription in vanilla, so they never run during construction and they run on *every*
	// notification rather than on a transition. Keying on the revision keeps both true.
	const storedValue = useRef<T | undefined>(undefined);
	const lastRevision = useRef<number | null>(null);
	useEffect(() => {
		if (lastRevision.current === revision) return;
		const construction = lastRevision.current === null;
		lastRevision.current = revision;
		if (construction) return;

		// What `currentValue` holds as each step runs, in the order vanilla runs them.
		let current = value;
		if (hidden) {
			if (storedValue.current === undefined) {
				storedValue.current = value;
				current = config.zeroValue;
				setValue(current);
			}
		} else if (storedValue.current !== undefined) {
			const restored = storedValue.current;
			storedValue.current = undefined;
			// The source may have been given a real value while the picker was hidden — by a preset,
			// say — and that beats whatever was put aside.
			if (config.equals(value, config.zeroValue)) {
				current = restored;
				setValue(current);
			}
		}

		// An option that has just gone away takes the selection with it. Vanilla compares with `==`
		// on the raw value rather than through `config.equals`, so an object-valued config never
		// matches; `===` is the same comparison for every value this is reachable with.
		if (config.values.some(valueConfig => !shows(valueConfig) && valueConfig.value === current)) setValue(config.zeroValue);
	});

	// `Input.update()` writes `disabled` on the input element as well as the class on the root.
	// It goes on the rendered anchor rather than through `Menu.Trigger`'s own `disabled` prop, which
	// would stop the menu opening — Bootstrap's `isDisabled` reads the *button's* class list and the
	// vanilla picker puts `disabled` on the root, so a disabled icon-enum picker still opened.
	const disabledAttribute = (disabled ? { disabled: true } : {}) as Record<string, boolean>;

	const horizontal = config.direction === IconEnumPickerDirection.Horizontal;
	// `config.tooltip` was a tippy on the root and each value's was one on its own anchor. One
	// react-tooltip serves both: the text rides on the anchor, and the node costs nothing until the
	// first hover. The root cannot be the anchor — `PickerShell` owns it — so the button is, and the
	// root is the button plus a label that is `display: none` unless the value carries text.
	const tooltips = !!config.tooltip || config.values.some(valueConfig => !!valueConfig.tooltip);

	return (
		<PickerShell
			config={config as typeof config & { id: string }}
			cssClass={clsx('icon-enum-picker-root', 'icon-picker', horizontal ? 'dropend' : 'dropdown')}
			hidden={hidden}
			disabled={disabled}>
			{/* A dropdown is not a modal surface, and Bootstrap's was not one either. */}
			<Menu.Root modal={false}>
				<Menu.Trigger
					nativeButton={false}
					// Both attributes go on the rendered element rather than on the part, which types its props
					// for a generic element and has a `disabled` of Base UI's own that would stop the menu
					// opening.
					//
					// The button links to the selected value’s wowhead page and to nothing otherwise — two
					// deliberate divergences. Vanilla writes `javascript:void(0)` at construction, which React
					// refuses to render (it substitutes a `javascript:` URL that *throws*), and both spellings
					// answer "no link" to everything that reads this attribute, the settings gate’s row key
					// included; `nativeButton={false}` is what keeps the anchor focusable without one. And
					// vanilla only ever *overwrites* the href, so a value carrying just a colour or an iconUrl
					// keeps the previous value’s link — reproducing that would mean tracking history to render
					// a link to the wrong page.
					render={<a href={selectedHidden ? undefined : href || undefined} {...disabledAttribute} />}
					openOnHover
					delay={0}
					className={clsx('icon-picker-button', active && 'active')}
					style={selectedHidden ? undefined : selected ? iconStyleOf(selected, iconUrl) : backupId ? actionIconStyle(iconUrl) : undefined}
					data-whtticon="false"
					data-disable-wowhead-touch-tooltip="true"
					data-tooltip-id={config.tooltip ? tooltipId : undefined}
					data-tooltip-content={config.tooltip}
				/>
				{/* Where vanilla's `<ul>` sat. See the note above the component. */}
				<div className="icon-enum-picker-slot" ref={setSlot} />
				<Menu.Portal container={slot} keepMounted className="icon-enum-picker-portal">
					{/* Bootstrap put a `.dropdown` menu below its toggle and a `.dropend` one to the
					    right, both start-aligned, and `bootstrap_overrides.ts` set the plugin's offset
					    to [0, -1] — a 1px overlap of the toggle's border. */}
					<Menu.Positioner side={horizontal ? 'right' : 'bottom'} align="start" sideOffset={-1} className="icon-enum-picker-positioner">
						<Menu.Popup
							render={<ul />}
							className="icon-enum-picker-menu"
							style={{
								gridTemplateColumns: config.numColumns ? `repeat(${config.numColumns}, 1fr)` : undefined,
								gridAutoFlow: horizontal ? 'column' : undefined,
							}}>
							{config.values.map((valueConfig, index) => (
								// The lists are module-level constants that never reorder, and the value
								// configs carry no id of their own, so the index is the key.
								<IconEnumOption
									key={index}
									valueConfig={valueConfig}
									hidden={!shows(valueConfig)}
									tooltipId={tooltipId}
									onSelect={() => {
										// Vanilla drops the put-aside value here: choosing something is
										// what makes a pending restore wrong.
										storedValue.current = undefined;
										setValue(valueConfig.value);
									}}
								/>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			{/* The button's caption. Vanilla renders it whether or not any value carries text, and
			    hides it inline when the selected one does not. */}
			<label className="form-label" style={{ display: selected?.text === undefined ? 'none' : 'block' }}>
				{selected?.text}
			</label>
			{tooltips && <Tooltip id={tooltipId} />}
		</PickerShell>
	);
};
