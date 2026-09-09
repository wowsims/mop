import { BulkItemSearch } from '@features/bulk/components/BulkItemSearch';
import { BulkPickerGroups } from '@features/bulk/components/BulkPickerGroups';
import { BulkProgressDialog } from '@features/bulk/components/BulkProgress';
import { BulkResults } from '@features/bulk/components/BulkResults';
import { BulkSettings } from '@features/bulk/components/BulkSettings';
import { useBulkRevision } from '@features/bulk/hooks/useBulkRevision';
import { useBulkTab } from '@features/bulk/hooks/useBulkTab';
import { SelectorModal } from '@features/gear/components/SelectorModal';
import { BulkGearImporterDialog } from '@features/import-export';
import { REPO_RELEASES_URL } from '@sim/constants/other';
import { useSimHost } from '@sim/context/SimHostContext';
import { ItemSpec } from '@generated/proto/common';
import i18n from '@i18n/config';
import { useSimReady } from '@sim/hooks/useSimReady';
import { useTabFade } from '@ui-kit/hooks/useTabFade';
import { Icon } from '@ui-kit/Icon';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

const PANES = [
	{ id: 'bulkSetupTab', labelKey: 'bulk_tab.tabs.setup' },
	{ id: 'bulkResultsTab', labelKey: 'bulk_tab.tabs.results' },
] as const;

type BulkPaneId = (typeof PANES)[number]['id'];

export const BulkTabBody = () => {
	const host = useSimHost();
	const bt = useBulkTab();
	const ready = useSimReady();
	useBulkRevision();

	const [activeId, setActiveId] = useState<BulkPaneId>('bulkSetupTab');
	const [importOpen, setImportOpen] = useState(false);
	const shownId = useTabFade(activeId);
	const results = bt.getResults();
	// Starting a run clears the results and drops back to setup; finishing one opens the results.
	useEffect(() => setActiveId(results ? 'bulkResultsTab' : 'bulkSetupTab'), [results]);

	return (
		<>
			<div className="bulk-tab-left tab-panel-left">
				<div className="bulk-tab-tabs">
					<ul className="nav nav-tabs" role="tablist">
						{PANES.map(pane => (
							<li key={pane.id} className="nav-item" role="presentation">
								<button
									type="button"
									className={clsx('nav-link', pane.id === activeId && 'active')}
									role="tab"
									aria-controls={pane.id}
									aria-selected={pane.id === activeId}
									tabIndex={pane.id === activeId ? undefined : -1}
									onClick={() => setActiveId(pane.id)}>
									{i18n.t(pane.labelKey)}
								</button>
							</li>
						))}
					</ul>
					<div className="tab-content">
						<div
							id="bulkSetupTab"
							role="tabpanel"
							className={clsx('tab-pane fade', activeId === 'bulkSetupTab' && 'active', shownId === 'bulkSetupTab' && 'show')}>
							<p className="mb-0" dangerouslySetInnerHTML={{ __html: i18n.t('bulk_tab.description') }} />
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
									onClick={() => bt.addItems(host.sim.getFilters().favoriteItems.map(itemID => ItemSpec.create({ id: itemID })))}>
									<Icon name="download" style="base" className="me-1" /> {i18n.t('bulk_tab.actions.import_favorites')}
								</button>
								<button type="button" className="btn btn-danger ms-auto" onClick={() => bt.clearItems()}>
									<Icon name="times" className="me-1" />
									{i18n.t('bulk_tab.actions.clear_items')}
								</button>
							</div>
							<BulkItemSearch ready={ready} />
							<BulkPickerGroups />
						</div>
						<div
							id="bulkResultsTab"
							role="tabpanel"
							className={clsx('tab-pane fade', activeId === 'bulkResultsTab' && 'active', shownId === 'bulkResultsTab' && 'show')}>
							<BulkResults />
						</div>
					</div>
				</div>
			</div>
			<BulkSettings />
			{importOpen && <BulkGearImporterDialog open onOpenChange={setImportOpen} />}
			<SelectorModal opener={bt.selectorModal} id="bulk-selector-modal" rail={false} />
			{bt.isBulkRunning() && <BulkProgressDialog />}
		</>
	);
};
