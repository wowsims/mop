import './ImportExportMenu.scss';

import { Menu } from '@base-ui/react/menu';
import { Icon } from '@ui-kit/Icon';
import type { IconName, IconStyle } from '@ui-kit/Icon/types';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useId, useState, useSyncExternalStore } from 'react';

import type { ImportExportKind, ImportExportRegistry } from '../import_export_registry';

export interface ImportExportMenuProps {
	kind: ImportExportKind;
	registry: ImportExportRegistry;
	icon: IconName;
	/** These menus were written with the bare `fa` prefix, which is what `base` emits. */
	iconStyle?: IconStyle;
	title: string;
}

/**
 * One of the header's two dropdowns, on Base UI's `Menu` instead of Bootstrap's plugin.
 *
 * `openOnHover` is what `shared/bootstrap_overrides.ts` used to add on top of Bootstrap from a
 * capturing `mouseover` on `body` — here it is a prop. `delay={0}` matches that listener, which
 * called `show()` on the first `mouseover` with no wait.
 *
 * The popup portals to `<body>`, so none of the header's descendant selectors reach it: its styles
 * are keyed on its own class and read the `--dropdown-*` tokens rather than Bootstrap's
 * `--bs-dropdown-*`, which are emitted inside `.dropdown-menu` and would resolve to nothing here.
 */
export const ImportExportMenu = ({ kind, registry, icon, iconStyle = 'base', title }: ImportExportMenuProps) => {
	const entries = useSyncExternalStore(
		registry.subscribe,
		() => registry.getEntries(kind),
		() => registry.getEntries(kind),
	);
	const unsupportedId = useId();
	const [open, setOpen] = useState(false);
	// Which React dialog is showing, by label. A vanilla entry opens its own Bootstrap modal and is
	// not tracked here; a React one has no `open()` to call, so this is where "open" lives.
	const [openDialog, setOpenDialog] = useState<string | null>(null);
	// KNOWN DIVERGENCE, recorded in `header-toolbar.mjs` and the skill. Bootstrap's click data-API
	// toggled a hover-opened menu shut and it stayed shut, because re-opening needed a fresh
	// `mouseover` and the pointer had not moved. Base UI re-evaluates hover immediately, so the menu
	// comes straight back and a click on the trigger looks like it does nothing.
	//
	// Two ways of suppressing it were tried and both lost the race with Base UI's own hover
	// scheduling: closing from a controlled `onOpenChange`, and turning `openOnHover` off until
	// `pointerleave`. Left as is rather than fought further — hover-to-open, which is the behaviour
	// that matters, is identical.

	return (
		<div className={clsx('dropdown sim-dropdown-menu', `${kind}-dropdown`)}>
			{/* Controlled, and `modal={false}`: a dropdown is not a modal surface, and Bootstrap's was
			    not one either. */}
			<Menu.Root open={open} onOpenChange={setOpen} modal={false}>
				<Menu.Trigger openOnHover delay={0} className={`${kind}-link`}>
					<Icon name={icon} style={iconStyle} /> {title}
				</Menu.Trigger>
				<Menu.Portal>
					{/* Bootstrap landed the menu 1px over the header: its plugin default offset was [0, -1] and
					    the stylesheet then pulled it up another 2px. Measured, not guessed. */}
					<Menu.Positioner align="start" sideOffset={-1} className="sim-dropdown-positioner">
						<Menu.Popup className="sim-dropdown-popup">
							{entries.map(entry => (
								<Menu.Item
									key={entry.label}
									className="sim-dropdown-item"
									disabled={entry.isUnsupported}
									// Kept on the disabled branch too: the tooltip anchors on the item, and
									// `Menu.Item` does not stop it being hovered.
									{...(entry.isUnsupported ? tooltipAnchorProps(unsupportedId) : {})}
									onClick={() => {
										if (entry.isUnsupported) return;
										// A vanilla entry shows its own Bootstrap modal; a React one only has state.
										if (entry.Dialog) setOpenDialog(entry.label);
										else entry.open?.();
									}}>
									{entry.label}
								</Menu.Item>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			{/* Outside `Menu.Root`, not inside its popup: clicking an item closes the menu, which unmounts
			    the popup, and a dialog rendered in there would go with it. Each dialog portals itself
			    to the sim root anyway, so this is a React-tree parent only. */}
			{entries.map(entry =>
				entry.Dialog ? (
					<entry.Dialog key={entry.label} open={openDialog === entry.label} onOpenChange={next => setOpenDialog(next ? entry.label : null)} />
				) : null,
			)}
			<Tooltip id={unsupportedId} content="Currently unsupported" />
		</div>
	);
};
