/** Canonical FontAwesome 6 names the app uses. FA5 spellings live in `ICON_ALIASES`. */
export type IconName =
	| 'arrow-left'
	| 'arrow-right'
	| 'arrow-right-arrow-left'
	| 'arrow-rotate-left'
	| 'arrow-up'
	| 'arrows-rotate'
	| 'ban'
	| 'bars'
	| 'bug'
	| 'bullseye'
	| 'calculator'
	| 'caret-down'
	| 'caret-right'
	| 'check'
	| 'check-circle'
	| 'chevron-left'
	| 'chevron-right'
	| 'circle-exclamation'
	| 'circle-question'
	| 'cog'
	| 'copy'
	| 'discord'
	| 'download'
	| 'ellipsis'
	| 'expand'
	| 'eye'
	| 'eye-slash'
	| 'file-arrow-up'
	| 'gauge-high'
	| 'github'
	| 'globe'
	| 'info-circle'
	| 'magnifying-glass-minus'
	| 'magnifying-glass-plus'
	| 'map-pin'
	| 'patreon'
	| 'pause'
	| 'paw'
	| 'pencil-alt'
	| 'play'
	| 'plus'
	| 'plus-minus'
	| 'right-from-bracket'
	| 'spinner'
	| 'star'
	| 'times'
	| 'triangle-exclamation'
	| 'user';

/** FA5 spellings still in the tree, mapped to their FA6 name. Both were live simultaneously. */
export const ICON_ALIASES = {
	'exclamation-triangle': 'triangle-exclamation',
	'exclamation-circle': 'circle-exclamation',
	'question-circle': 'circle-question',
	'rotate-left': 'arrow-rotate-left',
	'arrow-right-from-bracket': 'right-from-bracket',
} as const satisfies Record<string, IconName>;

export type IconAlias = keyof typeof ICON_ALIASES;

/** Style families, spelled once — the tree mixes `fas` and `fa-solid` for the same thing. */
export type IconStyle = 'solid' | 'regular' | 'brands';

/** Sizes FontAwesome defines. `fa-1xl`, used by the toast close button, is not one of them. */
export type IconSize = '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '1x' | '2x' | '3x' | '4x' | '5x';

export const ICON_STYLE_CLASS: Record<IconStyle, string> = {
	solid: 'fas',
	regular: 'far',
	brands: 'fab',
};
