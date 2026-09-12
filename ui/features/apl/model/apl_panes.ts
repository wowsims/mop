/** The three APL sub-tabs. The strip and the panes are rendered in different subtrees, so the ids and labels live here rather than in both. */
export const APL_PANES = [
	{ id: 'apl-priority-list', labelKey: 'rotation_tab.apl.tabs.priorityList' },
	{ id: 'apl-action-groups', labelKey: 'rotation_tab.apl.tabs.actionGroups' },
	{ id: 'apl-variables', labelKey: 'rotation_tab.apl.tabs.variables' },
] as const;

export type AplPaneId = (typeof APL_PANES)[number]['id'];
