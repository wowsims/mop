import { Menu } from '@base-ui/react/menu';
import { tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';

import type { MenuEntries } from './utils';

export interface DropdownMenuItemsProps<V> {
	entries: MenuEntries<V>;
	/** The one tooltip the whole menu shares; each option carries its own content on the anchor. */
	tooltipId: string;
	/** Selects the option at that position in the flat option list. */
	onSelect: (index: number) => void;
}

/**
 * The menu's rows, one level at a time.
 *
 * A submenu is a real nested popup, and `.dropdown-submenu` rides along so `_dropdown_picker.scss`
 * still reaches it. A submenu carrying a `trigger` keeps that option selectable — the owner of a
 * pet both opens the submenu and can be chosen. That trigger is not a radio item, so it reports no
 * `aria-checked`.
 */
export const DropdownMenuItems = <V,>({ entries, tooltipId, onSelect }: DropdownMenuItemsProps<V>) => (
	<>
		{entries.map((entry, position) =>
			entry.kind === 'option' ? (
				<Menu.RadioItem
					key={`option-${entry.index}`}
					render={<li />}
					value={entry.index}
					closeOnClick
					className={clsx('dropdown-picker-item', entry.option.className, entry.option.itemClassName)}
					{...tooltipAnchorProps(entry.option.tooltip === undefined ? undefined : tooltipId, entry.option.tooltip)}>
					{entry.option.icon}
					{entry.option.label}
				</Menu.RadioItem>
			) : (
				<Menu.SubmenuRoot key={`submenu-${entry.key}-${position}`}>
					<li className="dropdown-picker-item">
						<div className="dropend">
							<Menu.SubmenuTrigger
								render={<button type="button" className={clsx('dropdown-item', entry.trigger?.option.className)} />}
								onClick={entry.trigger ? () => onSelect(entry.trigger!.index) : undefined}
								{...tooltipAnchorProps(entry.trigger?.option.tooltip === undefined ? undefined : tooltipId, entry.trigger?.option.tooltip)}>
								{entry.trigger ? (
									<>
										{entry.trigger.option.icon}
										{entry.trigger.option.label}
									</>
								) : (
									entry.label
								)}
							</Menu.SubmenuTrigger>
							<Menu.Portal>
								<Menu.Positioner align="start" side="right" className="dropdown-picker-positioner">
									<Menu.Popup render={<ul />} className="dropdown-submenu dropdown-picker-menu">
										<DropdownMenuItems entries={entry.entries} tooltipId={tooltipId} onSelect={onSelect} />
									</Menu.Popup>
								</Menu.Positioner>
							</Menu.Portal>
						</div>
					</li>
				</Menu.SubmenuRoot>
			),
		)}
	</>
);
