// The icon vocabulary, closed on purpose.
//
// Every name below is one the app already uses. Keeping it a union rather than a string is what
// makes a typo, a dropped FontAwesome 5 alias or an invalid size a compile error instead of an icon
// that silently fails to render.

/**
 * Canonical FontAwesome 6 names. Where the tree previously used both a FA5 and a FA6 spelling of the
 * same glyph, only the FA6 name is listed and `ICON_ALIASES` maps the old one onto it.
 */
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

/**
 * FontAwesome 5 spellings still present in the tree, mapped to their FA6 name. Both spellings were
 * live simultaneously before this component existed — `fa-exclamation-triangle` in list_picker and
 * bulk_tab beside `fa-triangle-exclamation` in toast, and so on.
 */
export const ICON_ALIASES = {
	'exclamation-triangle': 'triangle-exclamation',
	'exclamation-circle': 'circle-exclamation',
	'question-circle': 'circle-question',
	'rotate-left': 'arrow-rotate-left',
	'arrow-right-from-bracket': 'right-from-bracket',
} as const satisfies Record<string, IconName>;

export type IconAlias = keyof typeof ICON_ALIASES;

/** Style families, spelled once. The tree currently mixes `fas` with `fa-solid` for the same thing. */
export type IconStyle = 'solid' | 'regular' | 'brands';

/**
 * Sizes FontAwesome actually defines. `fa-1xl`, which the toast close button used, is not among them
 * and never did anything.
 */
export type IconSize = '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '1x' | '2x' | '3x' | '4x' | '5x';

export const ICON_STYLE_CLASS: Record<IconStyle, string> = {
	solid: 'fas',
	regular: 'far',
	brands: 'fab',
};
