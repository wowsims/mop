/** Canonical FontAwesome 6 names the app uses. FA5 spellings live in `ICON_ALIASES`. */
export type IconName =
	| 'arrow-left'
	| 'arrow-right'
	| 'arrow-right-arrow-left'
	| 'arrow-right-from-bracket'
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
	| 'rotate-left'
	| 'spinner'
	| 'star'
	| 'times'
	| 'triangle-exclamation'
	| 'user';

/**
 * FA5 spellings still in the tree, mapped to their FA6 name. Both were live simultaneously.
 *
 * `rotate-left` and `arrow-right-from-bracket` are deliberately NOT here. They were mapped to
 * `arrow-rotate-left` and `right-from-bracket`, but in the pinned 6.0.0 CSS those are four distinct
 * glyphs — \f2ea vs \f0e2 and \f2f5 vs \f08b — so each "alias" silently swapped the icon. Both
 * are canonical names above instead, and each renders its own glyph.
 */
export const ICON_ALIASES = {
	'exclamation-triangle': 'triangle-exclamation',
	'exclamation-circle': 'circle-exclamation',
	'question-circle': 'circle-question',
} as const satisfies Record<string, IconName>;

export type IconAlias = keyof typeof ICON_ALIASES;

/**
 * Style families, spelled once — the tree mixes `fas` and `fa-solid` for the same thing.
 *
 * `base` is the bare `fa` prefix. It is not a family of its own: FontAwesome resolves it to the
 * default style, which is what the header toolbar and the import/export menus were written with.
 */
export type IconStyle = 'solid' | 'regular' | 'brands' | 'base';

/** Sizes FontAwesome defines. `fa-1xl`, used by the toast close button, is not one of them. */
export type IconSize = '2xs' | 'xs' | 'sm' | 'lg' | 'xl' | '2xl' | '1x' | '2x' | '3x' | '4x' | '5x';

export const ICON_STYLE_CLASS: Record<IconStyle, string> = {
	solid: 'fas',
	regular: 'far',
	brands: 'fab',
	base: 'fa',
};
