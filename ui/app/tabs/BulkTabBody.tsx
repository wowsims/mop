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
import { Button } from '@ui-kit/Button';
import { Icon } from '@ui-kit/Icon';
import { TabNav, TabPanel, TabPanels } from '@ui-kit/TabNav';
import { TabPanelColumns } from '@ui-kit/TabPanelColumns';
import { LocaleHtml } from '@ui-kit/Tooltip';
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
			<TabPanelColumns.Left className="pt-2" variant="auto-columns">
				<Tabs.Root data-testid="bulk-tab-tabs" value={activeId} onValueChange={next => setActiveId(next as BulkPaneId)}>
					<TabNav tabs={PANES.map(pane => ({ id: pane.id, label: i18n.t(pane.labelKey) }))} />
					<TabPanels>
						<TabPanel value="bulkSetupTab" className="gap-6 not-data-hidden:grid">
							<p className="mb-0">
								<LocaleHtml html={i18n.t('bulk_tab.description')} />
							</p>
							<div>
								{ready && host.sim.isNative === false && (
									<p className="mb-0">
										<a href={REPO_RELEASES_URL} target="_blank" rel="noopener noreferrer">
											<Icon name="gauge-high" className="mr-1" />
											{i18n.t('bulk_tab.download_native')}
										</a>
									</p>
								)}
							</div>
							<div className="flex grid-flow-col gap-3" data-testid="bulk-gear-actions">
								<Button variant="secondary" onClick={() => setImportOpen(true)}>
									<Icon name="download" style="base" className="mr-1" /> {i18n.t('bulk_tab.actions.import_bags')}
								</Button>
								<Button
									variant="secondary"
									onClick={() =>
										addBulkItems(
											host.player,
											host.sim.getFilters().favoriteItems.map(itemID => ItemSpec.create({ id: itemID })),
										)
									}>
									<Icon name="download" style="base" className="mr-1" /> {i18n.t('bulk_tab.actions.import_favorites')}
								</Button>
								<Button variant="danger" className="ml-auto" onClick={() => clearBulkItems(host.player)}>
									<Icon name="times" className="mr-1" />
									{i18n.t('bulk_tab.actions.clear_items')}
								</Button>
							</div>
							<BulkItemSearch ready={ready} />
							<BulkPickerGroups />
						</TabPanel>
						<TabPanel value="bulkResultsTab">
							<BulkResults />
						</TabPanel>
					</TabPanels>
				</Tabs.Root>
			</TabPanelColumns.Left>
			<BulkSettings />
			{importOpen && <BulkGearImporterDialog open onOpenChange={setImportOpen} />}
			<SelectorModal state={selector} id="bulk-selector-modal" rail={false} />
			{isRunning && <BulkProgressDialog />}
		</OpenSelectorModalContext>
	);
};
