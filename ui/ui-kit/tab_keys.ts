const NAV_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

/** Bootstrap's `Tab._keydown`: arrows wrap in both axes, Home/End jump to the ends, and the landing tab is focused *and* activated. */
export const nextTabByKey = <Tab extends { id: string }>(tabs: ReadonlyArray<Tab>, current: string, key: string): Tab['id'] | null => {
	if (!NAV_KEYS.includes(key)) return null;
	if (key === 'Home') return tabs[0]?.id ?? null;
	if (key === 'End') return tabs[tabs.length - 1]?.id ?? null;
	const index = tabs.findIndex(tab => tab.id === current);
	if (index < 0) return null;
	const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
	return tabs[(index + step + tabs.length) % tabs.length].id;
};
