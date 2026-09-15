import { Menu } from '@base-ui/react/menu';
import { usePortalContainer } from '@ui-kit/hooks/usePortalContainer';
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
 * A submenu is a real nested popup. A submenu carrying a `trigger` keeps that option selectable —
 * the owner of a pet both opens the submenu and can be chosen. That trigger is not a radio item,
 * so it reports no `aria-checked`.
 */
export const DropdownMenuItems = <V,>({ entries, tooltipId, onSelect }: DropdownMenuItemsProps<V>) => {
	const portalContainer = usePortalContainer();
	return (
		<>
			{entries.map((entry, position) =>
				entry.kind === 'option' ? (
					<li key={`option-${entry.index}`} role="none">
						<Menu.RadioItem
							render={<button type="button" />}
							value={entry.index}
							closeOnClick
							className={clsx('ui-menu-item', 'ui-menu-item-row', entry.option.className, entry.option.itemClassName)}
							data-testid="dropdown-picker-item"
							{...tooltipAnchorProps(entry.option.tooltip === undefined ? undefined : tooltipId, entry.option.tooltip)}>
							{entry.option.icon}
							{entry.option.label}
						</Menu.RadioItem>
					</li>
				) : (
					<Menu.SubmenuRoot key={`submenu-${entry.key}-${position}`}>
						<li role="none">
							<Menu.SubmenuTrigger
								render={
									<button
										type="button"
										className={clsx('ui-menu-item', 'ui-menu-item-row', entry.trigger?.option.className)}
										data-testid="dropdown-item"
									/>
								}
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
							<Menu.Portal container={portalContainer ?? undefined}>
								<Menu.Positioner align="start" side="right" className="ui-menu-positioner" data-testid="dropdown-picker-positioner">
									<Menu.Popup render={<ul />} className="ui-menu" data-testid="dropdown-submenu">
										<DropdownMenuItems entries={entry.entries} tooltipId={tooltipId} onSelect={onSelect} />
									</Menu.Popup>
								</Menu.Positioner>
							</Menu.Portal>
						</li>
					</Menu.SubmenuRoot>
				),
			)}
		</>
	);
};
