export interface DetailedResultsTabConfig {
	id: string;
	labelKey: string;
	className?: string;
}

export const DETAILED_RESULTS_TABS: ReadonlyArray<DetailedResultsTabConfig> = [
	{ id: 'damageTab', labelKey: 'results_tab.details.tabs.damage', className: 'damage-metrics-tab' },
	{ id: 'healingTab', labelKey: 'results_tab.details.tabs.healing', className: 'healing-metrics-tab' },
	{ id: 'damageTakenTab', labelKey: 'results_tab.details.tabs.damage_taken', className: 'threat-metrics-tab' },
	{ id: 'buffsTab', labelKey: 'results_tab.details.tabs.buffs' },
	{ id: 'debuffsTab', labelKey: 'results_tab.details.tabs.debuffs' },
	{ id: 'castsTab', labelKey: 'results_tab.details.tabs.casts' },
	{ id: 'resourcesTab', labelKey: 'results_tab.details.tabs.resources' },
	{ id: 'timelineTab', labelKey: 'results_tab.details.tabs.timeline' },
	{ id: 'replayTab', labelKey: 'results_tab.details.tabs.replay' },
	{ id: 'logTab', labelKey: 'results_tab.details.tabs.log' },
];

export const DEFAULT_DETAILED_RESULTS_TAB = 'damageTab';

/** Ties a pane to the tab button that controls it. */
export const tabButtonId = (tabId: string): string => `${tabId}-nav`;
