// Divergences the port means to have, in one list because two gates compare the same trees:
// `parity.mjs` takes the shell and every pane at load, `panes-parity.mjs` takes each pane once
// opened. Keeping a copy in each was going to end with them disagreeing about what is intended.
//
// This is **not** an allowlist. `parity.mjs` requires every entry to still be observed, so reverting
// the markup fails as loudly as making the change unrecorded would have. It owns that check because
// it is the gate that sees both regions; `panes-parity.mjs` enforces only the per-entry `max`.
//
// An entry names `base`/`react` as an exact string or a `RegExp`, or carries `match(base, react)` for
// a line whose text varies per spec. `max` caps how many lines one entry may fold in a single region —
// without it, a fixed pair like `label.form-label` would absorb every other label in the pane.
//
// Every entry below C-1a's refit is one of the four structural label→heading/caption rewrites; the
// seventeen purely class-shaped entries this list used to carry (a Bootstrap class swapped for a
// Tailwind one, with no tag or structural change) were deleted once `parity.mjs`/`panes-parity.mjs`
// started comparing tag trees through `compareKey` and stopped seeing classes at all — see
// `TAILWIND-DIVERGENCE.md`'s "Stage 4 — C-1a" entry for what each of them used to record and where
// that finding now lives.
export const INTENDED = [
	{
		base: /^label\.(.*\.)?character-stats-label(\.|$)/,
		react: /^h3\.(.*\.)?character-stats-label(\.|$)/,
		max: 1,
		why: 'a <label> with no control is not a label; the sidebar heading is a heading',
	},
	{
		// The negative lookahead is what keeps this from also absorbing the two more specific
		// `form-label` entries below now that a class can sit anywhere in the token list: a plain
		// `label.form-label` and `label.form-label.list-picker-title` both "contain form-label", so
		// without it this entry would swallow every line the next two are meant to fold instead.
		base: /^label\.(?!(?:.*\.)?(?:list-picker-title|multi-icon-picker-label)(?:\.|$))(.*\.)?form-label(\.|$)/,
		react: /^span\.(?!(?:.*\.)?(?:list-picker-title|multi-icon-picker-label)(?:\.|$))(.*\.)?form-label(\.|$)/,
		max: 5,
		why: 'a <label> with no control is not a label. Item swap and the four visible consume rows each name an icon group, so the label is a <span> and the group it names carries role=group + aria-labelledby',
	},
	{
		base: /^label\.(.*\.)?form-label\.(.*\.)?list-picker-title(\.|$)/,
		react: /^span\.(.*\.)?form-label\.(.*\.)?list-picker-title(\.|$)/,
		max: 4,
		why: "same rule again, for a ListPicker's own caption: it names the list, not a control, so it is a <span>. Four is the rotation pane's ceiling — the pre-pull, priority, action-group and variable lists — and a group's own action list adds one more only once a group exists, which no spec's default rotation has",
	},
	{
		base: /^label\.(.*\.)?form-label\.(.*\.)?multi-icon-picker-label(\.|$)/,
		react: /^span\.(.*\.)?form-label\.(.*\.)?multi-icon-picker-label(\.|$)/,
		max: 8,
		why: "same rule as the entry above, for MultiIconPicker's own caption: it names the picker's icon group, so the root carries role=group + aria-labelledby",
	},
];
