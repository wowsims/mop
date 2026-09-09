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
		max: 5,
		why: 'a <label> with no control is not a label. Item swap and the four visible consume rows each name an icon group, so the label is a <span> and the group it names carries role=group + aria-labelledby',
	},
	{
		base: 'label.form-label.list-picker-title',
		react: 'span.form-label.list-picker-title',
		max: 4,
		why: "same rule again, for a ListPicker's own caption: it names the list, not a control, so it is a <span>. Four is the rotation pane's ceiling — the pre-pull, priority, action-group and variable lists — and a group's own action list adds one more only once a group exists, which no spec's default rotation has",
	},
	{
		base: 'label.form-label.multi-icon-picker-label',
		react: 'span.form-label.multi-icon-picker-label',
		max: 8,
		why: "same rule as the entry above, for MultiIconPicker's own caption: it names the picker's icon group, so the root carries role=group + aria-labelledby",
	},
	{
		base: 'i.fa-question-circle.far',
		react: 'i.fa-circle-question.far',
		max: 8,
		why: "a React ContentBlock's header tooltip — and now a React ListPicker's title tooltip — is the React TooltipButton, which draws its glyph through Icon, and Icon spells FA6's canonical name where the vanilla button hardcodes FA5's alias. Same glyph in the pinned 6.0.0 CSS. Eight is the rotation pane's ceiling, and mage/fire is where it is reached: the four APL list titles, the three Preset Configuration blocks (RotationSidebar is repeated in the auto, simple and APL panes) and the Cooldowns block. It is the only spec here with a simple rotation, so it is the only one with a third sidebar or a cooldowns block at all; warrior/protection and priest/shadow hold the same pane to six. warrior/protection's settings pane — buffs, debuffs, the two external-cooldown blocks and the preset picker — is the next largest at five. It rises with every tab that follows",
	},
	{
		base: 'i.fa-3x.fa-exclamation-triangle.fas',
		react: 'i.fa-3x.fa-triangle-exclamation.fas',
		max: 1,
		why: "the sidebar's warning trigger draws its glyph through Icon, which spells FA6's canonical name where the vanilla button hardcoded FA5's alias. Same glyph in the pinned 6.0.0 CSS. One warning trigger per sidebar, and the sidebar is in parity.mjs's shell region, so the cap is exact",
	},
	{
		base: 'div.cooldown-action-picker.dropdown.icon-enum-picker-root.icon-picker.input-root',
		react: 'div.cooldown-action-picker.dropdown.hide.icon-enum-picker-root.icon-picker.input-root',
		max: 1,
		why: "an IconEnumPicker hides itself when no option carries an actionId, and the baseline only ever applies that rule on the *second* evaluation. `Input.update()` (ui/ui-kit/input.tsx:126) writes `hide` from `inputConfig.showWhen` alone — `actionPickerConfig` sets none — and the class's own `showWhen()` (icon_enum_picker.tsx:265), the one that also demands an actionId, is reached only from the constructor's store-change callback on line 66. So a freshly built vanilla picker is never hidden, whatever its values are. React reads the same rule on every render, first one included, which is what IconEnumPicker.test.tsx asserts. The two only part company where the values are the grey zero value alone, i.e. where `availableCooldowns` is empty: mage/fire's `hiddenMCDs` hides every one of its major cooldowns because its simple rotation casts them itself, and it is the only spec here in that state — druid/feral also has a simple rotation and four available cooldowns, and its picker is shown on both sides. Nothing is on screen either way: both ports write `hide` onto `.cooldown-settings` from that same empty list, and `.hide` is `display: none !important`. One add row per empty cooldown list, and a spec with none available has none saved either, so the cap is exact. Note it is observed on mage/fire alone — running parity.mjs on a spec list without it reports this entry unobserved",
	},
	{
		base: 'table.metrics-table.tablesorter',
		react: 'table.metrics-table',
		max: 21,
		why: '`.tablesorter` is the hook of the jQuery plugin the hand-rolled TableSorter replaced, and TableSorter is now gone too — no stylesheet, no script and no vendor bundle in ui/ or assets/ reads it. 21 is the results pane\'s whole table count, the six metric tables plus the fifteen resource ones, and no other pane has any',
	},
	{
		base: 'div.d-none.dropdown.dropdown-picker-root.input-root.target-filter-root.unit-picker-root',
		react: 'div.d-none.dropdown.dropdown-picker-root.target-filter-root.unit-picker-root',
		max: 1,
		why: "`input-root` is the vanilla `Input` shell's class, and the React results filter is deliberately not an `InputConfig` picker: its selection is the pane's own state, written through `value`/`onChange` with no store behind it. What that class contributed here is `.input-root`'s flex column, and nothing depends on it: the picker root is a flex item of `.results-filter-root` either way, the menu's positioner is `position: absolute` and out of flow, and `results-filter.mjs` reads the trigger's box back as identical on both ports. One results filter per sim",
	},
	{
		base: 'button.btn.dropdown-picker-button.dropdown-toggle.open-on-click',
		react: 'button.btn.dropdown-picker-button.dropdown-toggle',
		max: 450,
		why: "`open-on-click` is read by exactly one thing — `shared/bootstrap_overrides.ts:24`, which opens every *other* dropdown toggle on hover — and a Base UI menu is not a Bootstrap dropdown, so the opt-out has nothing to opt out of. No stylesheet selects it. The cap is the rotation pane's, not the results pane's: every APL kind picker, enum field, action-id field and unit field is one of these, plus the navbar's own rotation-type picker now that the navbar has ported, and warrior/protection's default rotation renders 422 of them — measured with `max: 0`, and 421 before the navbar. 450 is that with headroom, and the number moves with the preset rotation rather than with this port. The results pane contributes two at rest, the target filter and the log runner's add-filter picker",
	},
	{
		base: 'div.dropdown.dropdown-picker-root.dropup.input-root',
		react: 'div.dropdown.dropdown-picker-root.log-search-add-picker',
		max: 1,
		why: "the log runner's add-filter picker. `input-root` is the vanilla `Input` shell's class and the React picker is deliberately not an `InputConfig` picker — the group list is the pane's own state. `dropup` is Bootstrap's, and a Base UI menu is not a Bootstrap dropdown: opening upwards is `side=\"top\"` on the positioner now, which is what the picker's own test asserts. `.log-search-add-picker` is what scopes `normaliseBaseUiMenus`'s fold to it. One add-filter picker per log pane",
	},
	{
		base: 'input.form-control.log-search-input',
		react: 'input.form-control.log-search-input.search-bar-input',
		max: 1,
		why: "the log runner's free-text box is the `SearchBar` primitive now, and `search-bar-input` is the primitive's own hook. `log-search-input` still lands on the real control, which is the whole reason `SearchBar` puts `className` on the `<input>` rather than on its root. The two wrappers the primitive adds around it are folded by `normaliseLogSearch`; this entry is the line that is left. One search box per log pane",
	},
	{
		base: 'div.log-runner-logs',
		react: 'div.log-runner-logs.virtual-list',
		max: 1,
		why: "the React `VirtualList` **is** the log's content element rather than a child of it, so the consumer's class and the primitive's land on one div where vanilla had `.log-runner-logs` holding a list that added no element of its own. Nothing styles `.log-runner-logs`; it is structural on both sides. One list per log pane",
	},
	{
		// The root's class list carries the spec's own class, so this cannot be a fixed pair.
		match: (base, react) => base.includes('.hide-healing-metrics') && base.replace('.hide-healing-metrics', '') === react,
		describe: 'react drops hide-healing-metrics on a tank spec',
		max: 1,
		why: 'Sim.getShowHealingMetrics() derives from showThreatMetrics, and the vanilla shell only recomputed that class on showHealingMetrics — so a tank whose saved settings turned threat on kept hiding columns its own rule says to show',
	},
];
