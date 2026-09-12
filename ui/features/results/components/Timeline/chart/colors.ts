const resolved = new Map<string, string>();

// A canvas has no CSS cascade: a `var(--bs-*)` string assigned to strokeStyle is invalid
// and silently paints black, so every colour is resolved to a concrete value first.
export function cssVarColor(name: string): string {
	let value = resolved.get(name);
	if (value === undefined) {
		value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
		resolved.set(name, value);
	}
	return value;
}

export const AXIS_GRID_COLOR = 'rgba(255, 255, 255, 0.1)';
