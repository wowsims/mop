import './ImportExportMenu.scss';

import { Menu } from '@base-ui/react/menu';
import { childProps } from '@ui-kit/child_props';
import { Icon } from '@ui-kit/Icon';
import type { IconName, IconStyle } from '@ui-kit/Icon/types';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { type ReactNode, useId, useState } from 'react';

import type { ImportExportKind } from '../import_export';
import type { ImportExportItemProps } from './ImportExportItem';

export interface ImportExportMenuProps {
	kind: ImportExportKind;
	icon: IconName;
	iconStyle?: IconStyle;
	title: string;
	children: ReactNode;
}

export const ImportExportMenu = ({ kind, icon, iconStyle = 'base', title, children }: ImportExportMenuProps) => {
	const entries = childProps<ImportExportItemProps>(children);
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
					<Menu.Positioner align="start" sideOffset={-1} className="sim-dropdown-positioner">
						<Menu.Popup className="sim-dropdown-popup">
							{entries.map(entry => (
								<Menu.Item
									key={entry.label}
									className="sim-dropdown-item"
									disabled={entry.isUnsupported}
									{...(entry.isUnsupported ? tooltipAnchorProps(unsupportedId) : {})}
									onClick={() => {
										if (!entry.isUnsupported) setOpenDialog(entry.label);
									}}>
									{entry.label}
								</Menu.Item>
							))}
						</Menu.Popup>
					</Menu.Positioner>
				</Menu.Portal>
			</Menu.Root>
			{/* Outside `Menu.Root`, not inside its popup: clicking an item closes the menu, which unmounts the popup, and a dialog rendered in there would go with it. */}
			{entries.map(entry => (
				<entry.dialog key={entry.label} open={openDialog === entry.label} onOpenChange={next => setOpenDialog(next ? entry.label : null)} />
			))}
			<Tooltip id={unsupportedId} content="Currently unsupported" />
		</div>
	);
};
