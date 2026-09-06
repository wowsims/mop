import { Menu } from '@base-ui/react/menu';
import { useActionId } from '@ui-kit/hooks/useActionId';
import type { IconEnumValueConfig } from '@ui-kit/pickers/icon_enum_picker';
import clsx from 'clsx';

import { iconStyleOf } from './utils';

export interface IconEnumOptionProps<ModObject, T> {
	valueConfig: IconEnumValueConfig<ModObject, T>;
	/** The option's own `showWhen` said no. Rendered as the `hide` class, not unmounted. */
	hidden: boolean;
	/** One `Tooltip` serves the whole picker; the text rides on the anchor as `data-tooltip-content`. */
	tooltipId?: string;
	onSelect: () => void;
}

/**
 * One row of the menu: the `<li>` vanilla built with an anchor inside it.
 *
 * A `Menu.Item`, unlike anything in `MultiIconPicker`'s popup — these options are a *choice*, so
 * Bootstrap closed the menu on a click here (`clearMenus` hides for any target that is not an
 * `input`/`select`/`option`/`textarea`) and `closeOnClick` reproduces that.
 *
 * The item is the `<li>`, not the anchor, and the selection handler is the item's rather than the
 * anchor's: Base UI's press-drag-release gesture dispatches its click on the item element, so a
 * handler on the anchor would be skipped for that one gesture. `preventDefault` still reaches the
 * anchor's navigation from there, because a bubbled event is cancelled just as well as a direct one.
 *
 * It is its own component because each option resolves its own `ActionId`, and that is a hook.
 */
export const IconEnumOption = <ModObject, T>({ valueConfig, hidden, tooltipId, onSelect }: IconEnumOptionProps<ModObject, T>) => {
	// Vanilla's `setImage` returns before filling anything for a hidden option, so a hidden one never
	// fetches its icon either.
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
				data-whtticon="false"
				data-disable-wowhead-touch-tooltip="true"
				// An option anchor carries no href until its id resolves to a wowhead page, and loses
				// it while hidden — vanilla `removeAttribute`s it there. `ActionId.empty` resolves to
				// neither an item nor a spell, so the "No Pet" entry keeps none.
				href={hidden ? undefined : href || undefined}
				style={hidden ? undefined : iconStyleOf(valueConfig, iconUrl)}
				data-tooltip-id={valueConfig.tooltip ? tooltipId : undefined}
				data-tooltip-content={valueConfig.tooltip}
			/>
		</Menu.Item>
	);
};
