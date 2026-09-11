import { Tabs } from '@base-ui/react/tabs';
import { BulkItemSearch } from '@features/bulk/components/BulkItemSearch';
import { BulkPickerGroups } from '@features/bulk/components/BulkPickerGroups';
import { BulkProgressDialog } from '@features/bulk/components/BulkProgress';
import { BulkResults } from '@features/bulk/components/BulkResults';
import { BulkSettings } from '@features/bulk/components/BulkSettings';
import { useBulkState } from '@features/bulk/hooks/useBulkState';
import { addBulkItems, clearBulkItems } from '@features/bulk/model/items';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { OpenSelectorModalContext, useSelectorModalState } from '@features/gear/hooks/useSelectorModal';
import { BulkGearImporterDialog } from '@features/import-export';
import { ItemSpec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { REPO_RELEASES_URL } from '@sim/constants/other';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Icon } from '@ui-kit/Icon';
import { tabPaneClass } from '@ui-kit/tab_pane_class';
import { LocaleHtml } from '@ui-kit/Tooltip';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

const PANES = [
	{ id: 'bulkSetupTab', labelKey: 'bulk_tab.tabs.setup' },
	{ id: 'bulkResultsTab', labelKey: 'bulk_tab.tabs.results' },
] as const;

type BulkPaneId = (typeof PANES)[number]['id'];

export const BulkTabBody = () => {
	const host = useSimHost();
	const ready = useSimReady();
	const results = useBulkState(slice => slice.results);
	const isRunning = useBulkState(slice => slice.isRunning);

	const [activeId, setActiveId] = useState<BulkPaneId>('bulkSetupTab');
	const [importOpen, setImportOpen] = useState(false);
	const selector = useSelectorModalState();
	// Starting a run clears the results and drops back to setup; finishing one opens the results.
	useEffect(() => setActiveId(results ? 'bulkResultsTab' : 'bulkSetupTab'), [results]);

	return (
		<OpenSelectorModalContext value={selector.openTab}>
			<div className="bulk-tab-left tab-panel-left">
				<Tabs.Root className="bulk-tab-tabs" value={activeId} onValueChange={next => setActiveId(next as BulkPaneId)}>
					<Tabs.List className="nav nav-tabs" activateOnFocus render={<ul />}>
						{PANES.map(pane => (
							<li key={pane.id} className="nav-item" role="presentation">
								{/* Base UI's own `aria-controls` would point at nothing: `Tabs.Panel` registers a generated id rather than the one it renders. */}
								<Tabs.Tab value={pane.id} aria-controls={pane.id} className={state => clsx('nav-link', state.active && 'active')}>
									{i18n.t(pane.labelKey)}
								</Tabs.Tab>
							</li>
						))}
					</Tabs.List>
					<div className="tab-content">
						<Tabs.Panel value="bulkSetupTab" id="bulkSetupTab" keepMounted className={tabPaneClass}>
							<p className="mb-0">
								<LocaleHtml html={i18n.t('bulk_tab.description')} />
							</p>
							<div>
								{ready && host.sim.isNative === false && (
									<p className="mb-0">
										<a href={REPO_RELEASES_URL} target="_blank" rel="noopener noreferrer">
											<Icon name="gauge-high" className="me-1" />
											{i18n.t('bulk_tab.download_native')}
										</a>
									</p>
								)}
							</div>
							<div className="bulk-gear-actions">
								<button type="button" className="btn btn-secondary" onClick={() => setImportOpen(true)}>
									<Icon name="download" style="base" className="me-1" /> {i18n.t('bulk_tab.actions.import_bags')}
								</button>
								<button
									type="button"
									className="btn btn-secondary"
									onClick={() =>
										addBulkItems(
											host.player,
											host.sim.getFilters().favoriteItems.map(itemID => ItemSpec.create({ id: itemID })),
										)
									}>
									<Icon name="download" style="base" className="me-1" /> {i18n.t('bulk_tab.actions.import_favorites')}
								</button>
								<button type="button" className="btn btn-danger ms-auto" onClick={() => clearBulkItems(host.player)}>
									<Icon name="times" className="me-1" />
									{i18n.t('bulk_tab.actions.clear_items')}
								</button>
							</div>
							<BulkItemSearch ready={ready} />
							<BulkPickerGroups />
						</Tabs.Panel>
						<Tabs.Panel value="bulkResultsTab" id="bulkResultsTab" keepMounted className={tabPaneClass}>
							<BulkResults />
						</Tabs.Panel>
					</div>
				</Tabs.Root>
			</div>
			<BulkSettings />
			{importOpen && <BulkGearImporterDialog open onOpenChange={setImportOpen} />}
			<SelectorModal state={selector} id="bulk-selector-modal" rail={false} />
			{isRunning && <BulkProgressDialog />}
		</OpenSelectorModalContext>
	);
};
