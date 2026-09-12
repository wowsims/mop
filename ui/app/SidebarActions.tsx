import { isCustomEntry, type SidebarRegistry } from '@ui-kit/sidebar_registry';
import { SidebarActionButton } from '@ui-kit/SidebarActionButton';
import { Fragment, useSyncExternalStore } from 'react';

export interface SidebarActionsProps {
	registry: SidebarRegistry;
}

export const SidebarActions = ({ registry }: SidebarActionsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);

	return (
		<>
			{entries.map(entry =>
				isCustomEntry(entry) ? (
					<Fragment key={entry.id}>{entry.render()}</Fragment>
				) : (
					<SidebarActionButton key={entry.id} className={entry.className} onClick={entry.onClick} disabled={entry.disabled} loading={entry.loading}>
						{entry.label}
					</SidebarActionButton>
				),
			)}
		</>
	);
};
