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

// A unit can have no class colour - a target, or a pet the sim reports without one - so the
// caller supplies the series' own colour to fall back to rather than getting an empty string.
export function classColorValue(classColor: string, fallback: string): string {
	return classColor ? cssVarColor(`--bs-${classColor}`) : fallback;
}

export const AXIS_GRID_COLOR = 'rgba(255, 255, 255, 0.1)';
