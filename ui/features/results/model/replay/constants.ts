import { ResourceType } from '@generated/proto/spell';

/** How long a hit's flash and ring stay on the silhouette, and how long its damage number floats. */
export const HIT_WINDOW_SEC = 0.45;
export const DMG_WINDOW_SEC = 1.1;

/** Casts kept in the strip above the arena, and cards the formation draws before it falls back to `+N`. */
export const MAX_TICKER = 10;
export const MAX_ENEMIES = 8;

/** How long a cast keeps its action-grid icon and an aura keeps its freshly-gained ring. */
export const RECENT_WINDOW_SEC = 0.6;

export const REPLAY_TIME_FORMAT = {
	showMilliseconds: true,
	separatorStyle: 'colon',
	minimumUnit: 'minutes',
} as const;

/** Used for a resource whose log never reported a total, so the bar has a scale from the first frame. */
export const RESOURCE_MAX_DEFAULTS: Partial<Record<ResourceType, number>> = {
	[ResourceType.ResourceTypeMana]: 100,
	[ResourceType.ResourceTypeEnergy]: 100,
	[ResourceType.ResourceTypeRage]: 100,
	[ResourceType.ResourceTypeComboPoints]: 5,
	[ResourceType.ResourceTypeFocus]: 100,
	[ResourceType.ResourceTypeRunicPower]: 100,
	[ResourceType.ResourceTypeChi]: 5,
	[ResourceType.ResourceTypeBloodRune]: 1,
	[ResourceType.ResourceTypeFrostRune]: 1,
	[ResourceType.ResourceTypeUnholyRune]: 1,
	[ResourceType.ResourceTypeDeathRune]: 1,
};

/** Rows in this order lead the HUD; anything else the log carried follows in the order it appeared. */
export const RESOURCE_PRIORITY: ReadonlyArray<ResourceType> = [
	ResourceType.ResourceTypeMana,
	ResourceType.ResourceTypeEnergy,
	ResourceType.ResourceTypeComboPoints,
	ResourceType.ResourceTypeRage,
	ResourceType.ResourceTypeFocus,
	ResourceType.ResourceTypeRunicPower,
	ResourceType.ResourceTypeChi,
];

export const SEGMENTED_RESOURCE_TYPES = new Set([
	ResourceType.ResourceTypeComboPoints,
	ResourceType.ResourceTypeChi,
	ResourceType.ResourceTypeBloodRune,
	ResourceType.ResourceTypeFrostRune,
	ResourceType.ResourceTypeUnholyRune,
	ResourceType.ResourceTypeDeathRune,
]);
