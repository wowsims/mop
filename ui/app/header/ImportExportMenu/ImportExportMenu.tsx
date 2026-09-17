import { childProps } from '@ui-kit/child_props';
import { Icon } from '@ui-kit/Icon';
import type { IconName, IconStyle } from '@ui-kit/Icon/types';
import { Menu, MenuItem } from '@ui-kit/Menu';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
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

	return (
		<div className="static flex" data-testid="sim-dropdown-menu">
			<Menu
				surface="menu"
				open={open}
				onOpenChange={setOpen}
				trigger={
					<>
						<Icon name={icon} style={iconStyle} /> {title}
					</>
				}
				triggerProps={{
					openOnHover: true,
					delay: 0,
					className: 'py-4 px-4 text-sm data-popup-open:text-white',
					'data-testid': `${kind}-link`,
				}}
				align="start"
				sideOffset={-1}
				positionerProps={{ 'data-testid': 'sim-dropdown-positioner' }}
				popupProps={{ 'data-testid': 'sim-dropdown-popup' }}>
				{entries.map(entry => (
					<MenuItem
						key={entry.label}
						layout="block"
						data-testid="sim-dropdown-item"
						disabled={entry.isUnsupported}
						{...(entry.isUnsupported ? tooltipAnchorProps(unsupportedId) : {})}
						onClick={() => {
							if (!entry.isUnsupported) setOpenDialog(entry.label);
						}}>
						{entry.label}
					</MenuItem>
				))}
			</Menu>
			{/* Outside `Menu`, not inside its popup: clicking an item closes the menu, which unmounts the popup, and a dialog rendered in there would go with it. */}
			{entries.map(entry => (
				<entry.dialog key={entry.label} open={openDialog === entry.label} onOpenChange={next => setOpenDialog(next ? entry.label : null)} />
			))}
			<Tooltip id={unsupportedId} content="Currently unsupported" />
		</div>
	);
};
