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

/** Ties a pane to the tab button that controls it; the vanilla buttons carried no id, so no pane could point back at one. */
export const tabButtonId = (tabId: string): string => `${tabId}-nav`;

const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

/** Bootstrap's `Tab._keydown`: arrows wrap in both axes, Home/End jump to the ends, and the landing tab is focused *and* activated. */
export const nextTabByKey = (tabs: ReadonlyArray<DetailedResultsTabConfig>, current: string, key: string): string | null => {
	if (!NAV_KEYS.includes(key)) return null;
	if (key === 'Home') return tabs[0]?.id ?? null;
	if (key === 'End') return tabs[tabs.length - 1]?.id ?? null;
	const index = tabs.findIndex(tab => tab.id === current);
	if (index < 0) return null;
	const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
	return tabs[(index + step + tabs.length) % tabs.length].id;
};
