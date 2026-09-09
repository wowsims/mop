import { isCustomEntry, type SidebarRegistry } from '@ui-kit/sidebar_registry';
import { SidebarActionButton, SidebarDisabledContext } from '@ui-kit/SidebarActionButton';
import { Fragment, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export interface SidebarActionsProps {
	registry: SidebarRegistry;
	container: HTMLElement;
	disabled: boolean;
}

export const SidebarActions = ({ registry, container, disabled }: SidebarActionsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);

	return createPortal(
		<SidebarDisabledContext value={disabled}>
			{entries.map(entry =>
				isCustomEntry(entry) ? (
					<Fragment key={entry.id}>{entry.render()}</Fragment>
				) : (
					<SidebarActionButton key={entry.id} className={entry.cssClass} onClick={entry.onClick} disabled={entry.disabled} loading={entry.loading}>
						{entry.label}
					</SidebarActionButton>
				),
			)}
		</SidebarDisabledContext>,
		container,
	);
};
