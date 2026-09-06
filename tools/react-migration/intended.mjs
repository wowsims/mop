// Divergences the port means to have, in one list because two gates compare the same trees:
// `parity.mjs` takes the shell and every pane at load, `panes-parity.mjs` takes each pane once
// opened. Keeping a copy in each was going to end with them disagreeing about what is intended.
//
// This is **not** an allowlist. `parity.mjs` requires every entry to still be observed, so reverting
// the markup fails as loudly as making the change unrecorded would have. It owns that check because
// it is the gate that sees both regions; `panes-parity.mjs` enforces only the per-entry `max`.
//
// An entry names the exact `base` and `react` lines, or carries `match(base, react)` for a line
// whose text varies per spec. `max` caps how many lines one entry may fold in a single region —
// without it, a fixed pair like `label.form-label` would absorb every other label in the pane.
export const INTENDED = [
	{
		base: 'label.character-stats-label',
		react: 'h3.character-stats-label',
		max: 1,
		why: 'a <label> with no control is not a label; the sidebar heading is a heading',
	},
	{
		base: 'label.form-label',
		react: 'span.form-label',
		max: 1,
		why: "item swap's label names the icon group rather than a control, so it is a <span> and the group carries role=group + aria-labelledby",
	},
	{
		base: 'button.apl-validations.list-picker-item-action',
		react: 'button.apl-validation-warning.apl-validations.list-picker-item-action',
		max: 11,
		why: 'APL validation severity needs unit metadata, which the vanilla side never refreshes after the settings load because Sim.applyLoadedSettings suppressed the recompute and nothing ran it afterwards (fixed in sim.ts); baseline leaves all 116 validations unclassified. Delete this entry once the fix reaches feature/ui-restructure',
	},
	{
		base: 'button.apl-validations.list-picker-item-action',
		react: 'button.apl-validation-information.apl-validations.list-picker-item-action',
		max: 2,
		why: 'same recompute fix as the warning entry above, for the informational severity',
	},
	{
		base: 'i.fa.fa-exclamation-triangle.fa-xl',
		react: 'i.fa.fa-info-circle.fa-xl',
		max: 2,
		why: 'an informational validation gets the info glyph; the baseline shows every validation with the warning triangle because none are classified',
	},
	{
		// The root's class list carries the spec's own class, so this cannot be a fixed pair.
		match: (base, react) => base.includes('.hide-healing-metrics') && base.replace('.hide-healing-metrics', '') === react,
		describe: 'react drops hide-healing-metrics on a tank spec',
		max: 1,
		why: 'Sim.getShowHealingMetrics() derives from showThreatMetrics, and the vanilla shell only recomputed that class on showHealingMetrics — so a tank whose saved settings turned threat on kept hiding columns its own rule says to show',
	},
];
