import type { IconEnumPickerConfig, IconEnumValueConfig } from '@ui-kit/pickers/icon_enum_picker';
import type { CSSProperties } from 'react';

/**
 * `IconEnumPicker.showWhen()` — the picker's own override, not `Input`'s. The control disappears
 * unless its config says to show it *and* some value both carries an `actionId` and is itself shown,
 * so a list whose every real option has gone away takes the picker with it.
 *
 * Exported because a caller can need the answer without the picker: a consumes row hides when every
 * picker in it is hidden, which vanilla computed by asking each constructed instance. Nothing else
 * can answer it — `useInput`'s `hidden` is the config's own `showWhen` alone.
 */
export const iconEnumPickerShown = <ModObject, T>(config: IconEnumPickerConfig<ModObject, T>, modObject: ModObject): boolean =>
	(!config.showWhen || config.showWhen(modObject)) &&
	config.values.some(valueConfig => !!valueConfig.actionId && (!valueConfig.showWhen || valueConfig.showWhen(modObject)));

/** `setActionIdBackground`: the background is written only once the id has an icon to write. */
export const actionIconStyle = (iconUrl: string): CSSProperties | undefined => (iconUrl ? { backgroundImage: `url('${iconUrl}')` } : undefined);

/**
 * `IconEnumPicker.setImage` expressed as a value rather than as writes to an element, shared by the
 * button and by each option because vanilla calls the one function for both.
 *
 * The caller owns the two cases that are not about this value: a hidden one (vanilla returns before
 * writing anything) and a value the list does not carry (`backupIconUrl`).
 *
 * The unquoted `url(${iconUrl})` is vanilla's, and it matters: the "None" consumable carries
 * `iconUrl: ''`, so both sides emit `url()` — invalid, therefore dropped — rather than a request for
 * the page itself.
 *
 * Vanilla *mutates*, so it leaves history behind that this cannot and should not reproduce: the
 * colour branch clears the background image and the filter, but neither of the other two clears
 * `backgroundColor`, so a colour value selected before an icon value keeps its colour underneath.
 * Every live colour is `'#grey'`, which is not a colour, so nothing is lost by rendering the value
 * that is actually selected.
 */
export const iconStyleOf = <ModObject, T>(valueConfig: IconEnumValueConfig<ModObject, T>, filledIconUrl: string): CSSProperties | undefined => {
	if (valueConfig.actionId) return actionIconStyle(filledIconUrl);
	if (valueConfig.iconUrl) return { backgroundImage: `url(${valueConfig.iconUrl})`, filter: 'grayscale(1)' };
	return { backgroundColor: valueConfig.color };
};
