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
	iconStyle?: IconStyle;
	title: string;
}

export const ImportExportMenu = ({ kind, registry, icon, iconStyle = 'base', title }: ImportExportMenuProps) => {
	const entries = useSyncExternalStore(
		registry.subscribe,
		() => registry.getEntries(kind),
		() => registry.getEntries(kind),
	);
	const unsupportedId = useId();
	const [open, setOpen] = useState(false);
	const [openDialog, setOpenDialog] = useState<string | null>(null);
	// KNOWN DIVERGENCE, recorded in `header-toolbar.mjs` and the skill.

	return (
		<div className={clsx('dropdown sim-dropdown-menu', `${kind}-dropdown`)}>
			<Menu.Root open={open} onOpenChange={setOpen} modal={false}>
				<Menu.Trigger openOnHover delay={0} className={`${kind}-link`}>
					<Icon name={icon} style={iconStyle} /> {title}
				</Menu.Trigger>
				<Menu.Portal>
					{/* Bootstrap landed the menu 1px over the header: its plugin default offset was [0, -1] and the stylesheet then pulled it up another 2px. */}
					<Menu.Positioner align="start" sideOffset={-1} className="sim-dropdown-positioner">
						<Menu.Popup className="sim-dropdown-popup">
							{entries.map(entry => (
								<Menu.Item
									key={entry.label}
									className="sim-dropdown-item"
									disabled={entry.isUnsupported}
									{...(entry.isUnsupported ? tooltipAnchorProps(unsupportedId) : {})}
									onClick={() => {
										if (entry.isUnsupported) return;
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
			{/* Outside `Menu.Root`, not inside its popup: clicking an item closes the menu, which unmounts the popup, and a dialog rendered in there would go with it. */}
			{entries.map(entry =>
				entry.Dialog ? (
					<entry.Dialog key={entry.label} open={openDialog === entry.label} onOpenChange={next => setOpenDialog(next ? entry.label : null)} />
				) : null,
			)}
			<Tooltip id={unsupportedId} content="Currently unsupported" />
		</div>
	);
};
