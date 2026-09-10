import { isCustomEntry, type SidebarRegistry } from '@ui-kit/sidebar_registry';
import { SidebarActionButton, SidebarDisabledContext } from '@ui-kit/SidebarActionButton';
import { Fragment, useSyncExternalStore } from 'react';

export interface SidebarActionsProps {
	registry: SidebarRegistry;
	disabled: boolean;
}

export const SidebarActions = ({ registry, disabled }: SidebarActionsProps) => {
	const entries = useSyncExternalStore(registry.subscribe, registry.getEntries);

	return (
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
		</SidebarDisabledContext>
	);
};
