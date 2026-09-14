// The settings tab's behaviour — what its controls do once you operate them.
//
// `panes-parity.mjs` already compares this pane element for element on both builds, so the shape at
// rest is covered and nothing here repeats it: `SERIALIZE` emits tag plus sorted classes and
// *excludes text and attributes*, so labels, values, `for=`, `size=` and inline styles are invisible
// to it, and so is everything that only happens after a click. Seven of the nine content blocks are
// still vanilla. This lands before they port, so it describes the behaviour the port has to keep
// rather than the behaviour it happens to end up with.
//
// The whole output should be identical on both builds.
//
// One thing it records rather than fails on: `Input.buildLabel` writes `htmlFor={config.id ||
// undefined}`, and `config.id` is optional, so every icon input that has a label but no id renders
// `<label for="undefined">` — a `for` naming an element that does not exist. That is the tab's
// current state on both builds, so failing on it would make this gate red from the day it lands and
// gate nothing. The count is printed instead, which is what stops a port from spreading it.
//
// The icon pickers' menus are walked in a section of their own rather than inline. They used to come
// out of the pane walk for free, because vanilla builds every option into the picker at construction
// and leaves it there, so two thirds of this readout was menu contents nobody had opened. The port
// mounts a menu when it opens, so the pane holds none at rest and that coverage went with it — see
// `PORTED_MENUS` in browser.mjs, whose `eager` half is the `<ul>` this walk finds already standing on
// the baseline. Hence `MENU` below, which takes menu contents out of the at-rest tables on both
// builds so they agree again, and `menus` further down, which opens each picker in turn and prints
// what is inside.
import { launch, openSpec, PORTS, q } from './browser.mjs';

const SPEC = process.argv[2] ?? 'warrior/protection';
const PORT = Number(process.env.PORT ?? PORTS.base);
const IS_BASE = PORT === PORTS.base;

// Installed once, after the tab is open, rather than written as separate `page.evaluate` arrows.
// Three readers share one notion of "which control is this"; computing that key two different ways
// is how a before/after delta silently comes out empty forever.
const INSTALL = () => {
	const pane = () => document.getElementById('settings-tab');
	const text = el => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
	const q = name => `:is([data-testid="${name}"], .${name})`;

	// Every element a picker owns, in document order. `.input-root` is the `Input` base class's own
	// root, but two things that hide are not `Input`s and would otherwise take a whole class of
	// showWhen wiring out of this readout:
	//
	//  - `MultiIconPicker` is a plain `Component`, and its own `showWhen` toggles `hide` on
	//    `.multi-icon-picker-root`.
	//  - `IconEnumPicker` renders each option as an `<li class="icon-dropdown-option">` carrying that
	//    option's `showWhen` — the rogue-only conjured and the two engineering explosives hide there,
	//    on the `<li>`, not on any `.input-root`.
	//
	// `MultiIconPicker` also spells `icon-dropdown-option` onto its "clear" anchor, so each multi
	// picker contributes one extra row with an empty value. That is the class doing double duty in
	// the app, not a miscount here.
	const OWNERS = '.input-root, .multi-icon-picker-root, .icon-dropdown-option';

	// The `<ul>` an icon picker keeps its options in. Vanilla builds `dropdown-menu` into the picker in
	// its constructor and never takes it down; the port mounts Base UI's popup into the slot when the
	// picker opens and unmounts it when it closes. Both shapes are named here because the at-rest
	// tables must not see either one: on the baseline they are 89 rows of markup nobody has opened, and
	// on this branch they are nothing at all, which is what stopped the two builds' output matching.
	// These are `PORTED_MENUS`'s `eager` and popup lines, same two menus, same vocabulary.
	const MENU = 'ul.dropdown-menu, ul.icon-enum-picker-menu, ul.multi-icon-picker-menu';
	const inMenu = el => !!el.closest(MENU);

	// The two pickers whose options `menus` opens. Named by the class the row already reports as its
	// `kind`, so the walk and the table cannot disagree about what a picker is.
	const MENU_KINDS = ['icon-enum-picker-root', 'multi-icon-picker-root'];

	// The element this picker owns, not one belonging to a picker nested inside it: `.consumes-row`
	// and the multi-icon dropdowns both wrap other `.input-root`s.
	const own = (el, selector) => [...el.querySelectorAll(selector)].find(node => node.closest(OWNERS) === el) ?? null;

	// What the row *is*, from its own class list. Named rather than the whole sorted class list
	// because panes-parity already compares class lists byte for byte.
	const kindOf = el =>
		[...el.classList].find(name => name.endsWith('-picker-root')) ??
		(el.classList.contains('consumes-row') ? 'consumes-row' : null) ??
		(el.classList.contains('icon-dropdown-option') ? 'icon-dropdown-option' : null) ??
		'input-root';

	// Stable across a port that rewrites the markup around it: the control's `id` first, because
	// that is what `InputConfig.id` puts there and what the generic `configureInputSection` loop
	// preserves. Icon inputs have no id at all, so they key on the wowhead action the anchor points
	// at — `spell=20217` survives any wrapper change.
	const keyOf = el => {
		const control = own(el, 'input, select');
		if (control?.id) return control.id;
		if (el.classList.contains('consumes-row')) {
			// `ConsumeRow`'s label is i18n text; the `consumes-*` class on its inputs container is not.
			const tokens = [...el.querySelectorAll('[class]')]
				.flatMap(node => [...node.classList])
				.filter(name => name.startsWith('consumes-') && name !== 'consumes-row-inputs')
				.map(name => name.slice('consumes-'.length));
			return `row:${[...new Set(tokens)].sort().join('+') || '?'}`;
		}
		// By class, not by tag, for the reason spelled out at the `.form-label` read below: the React
		// caption is a `<span>` — it names an icon group rather than a control — so keying on `label`
		// silently turned every multi-icon row's key into `multi:?` on this build only.
		if (el.classList.contains('multi-icon-picker-root')) return `multi:${text(own(el, '.multi-icon-picker-label')) || '?'}`;
		const anchor = own(el, 'a');
		if (anchor) {
			const href = anchor.getAttribute('href');
			if (!href || href === '#' || href.startsWith('javascript:')) return 'unset';
			const action = href.match(/(spell|item)=(\d+)/);
			return action ? `${action[1]}=${action[2]}` : href;
		}
		return kindOf(el);
	};

	// The value as the user sees it, not as the model holds it. Number pickers reformat floats on
	// the way in (`0.4` renders `0.40`), and `size` is recomputed from the text on every keystroke —
	// an attribute no structural gate reads and a port using a controlled React input would drop.
	const valueOf = el => {
		const control = own(el, 'input, select');
		if (control?.type === 'checkbox') return `checked=${control.checked}`;
		if (control?.tagName === 'SELECT') return `${control.value} "${text(control.selectedOptions[0])}" of ${control.options.length}`;
		if (control) return `"${control.value}" size=${control.size}`;
		const anchor = own(el, 'a');
		if (anchor) return anchor.classList.contains('active') ? 'active' : 'inactive';
		return '';
	};

	// One row's readout. Shared by the pane walk and the menu walk, so an `IconPicker` reads the same
	// whether it sits in a consumes row or inside a multi-icon menu — the point of the exercise being
	// that the menu contents are the same rows they always were, printed somewhere else.
	// `siblings` is the list the ordinal and the depth are measured against.
	const rowOf = (el, siblings, ordinal, block) => {
		const control = own(el, 'input, select');
		// `.form-label`, not `label.form-label`: item swap's label is already a `<span>` on this
		// branch (`INTENDED` in intended.mjs — a label naming an icon group rather than a
		// control is not a label), and the tag is panes-parity's business. What is *this*
		// gate's business is the text, which `SERIALIZE` excludes and nothing else compares.
		const label = own(el, '.form-label');
		// `Input.buildLabel` writes `htmlFor` from the same `config.id` the control uses, so the
		// two must keep agreeing; nothing else in this repo checks that. `BROKEN` is reserved for
		// a `for` that names something other than this row's own control — the port regression
		// this is here to catch. `for="undefined"` is called out separately because it is the
		// state the tab is *already* in (see the header comment): `config.id` is optional and
		// tsx-vanilla stringifies the missing value into the attribute, so every labelled icon
		// input points at an id that does not exist. Failing on it would make this gate red on
		// both builds, which gates nothing; recording it pins the count so a port neither
		// spreads it nor silently paints over it.
		const forAttr = label?.getAttribute('for') ?? null;
		return {
			block,
			n: ordinal + 1,
			depth: siblings.filter(other => other !== el && other.contains(el)).length,
			key: keyOf(el),
			controlId: control?.id || null,
			kind: kindOf(el),
			label: text(label),
			htmlFor: !label
				? '-'
				: forAttr === null || forAttr === 'undefined'
					? // Both mean "this label names nothing". Vanilla writes the string `undefined`
						// when the config has no id; `PickerShell` omits the attribute instead. That
						// difference is a port fixing a defect, so it is counted below rather than
						// printed per row, where it would make this probe differ between the builds
						// for as long as the tab is half-ported.
						'unset'
					: forAttr === control?.id
						? 'ok'
						: `BROKEN:${forAttr}`,
			value: valueOf(el),
			hide: el.classList.contains('hide'),
			// Two signals: `Input.update` writes the class on the root and the attribute on the
			// control. A port that keeps one and drops the other still styles correctly and is
			// still broken for the keyboard.
			disabled: el.classList.contains('disabled'),
			disabledAttr: !!control?.hasAttribute('disabled'),
		};
	};

	// Nested `.input-root`s are real (a consumes row wraps three icon pickers), so depth is part of
	// the identity rather than something to flatten away. What is *not* part of it is anything a
	// picker's menu holds: the baseline's menus are standing at rest and this branch's are not, so
	// counting them here is what made the two builds' tables disagree.
	const ownersOf = block => [...block.querySelectorAll(OWNERS)].filter(el => !inMenu(el));

	const rows = () => {
		const out = [];
		for (const [index, block] of [...pane().querySelectorAll(q('content-block'))].entries()) {
			const owners = ownersOf(block);
			for (const [ordinal, el] of owners.entries()) out.push(rowOf(el, owners, ordinal, index));
		}
		return out;
	};

	window.settingsProbe = {
		blocks: () =>
			[...pane().querySelectorAll(q('content-block'))].map(block => ({
				// `buildColumn(n, 'settings-left-col')` names the three left columns; the right panel
				// holds the preset picker and the two saved-data managers.
				column: (() => {
					const col = block.closest(`${q('tab-panel-col')}, ${q('tab-panel-right')}`);
					if (!col) return '?';
					const leftCol = [...col.classList].find(name => name.startsWith('settings-left-col-'));
					if (leftCol) return leftCol;
					return col.matches(q('tab-panel-right')) ? 'tab-panel-right' : '?';
				})(),
				name: [...block.classList].find(name => name !== 'content-block' && name !== 'ui-content-block') ?? '?',
				title: text(block.querySelector(q('content-block-title'))),
				// Only the raid-buffs block appends one, and only through `headerElement`, which a port
				// that renders the header from a title string alone would drop.
				description: text(block.querySelector(`${q('content-block-header')} p`)),
				// Menu contents excluded, same as `ownersOf`: the baseline's multi-icon menus each hold
				// their inputs' `IconPicker`s, which put this column 26 over on Raid Buffs and 10 over on
				// Debuffs while this branch's menus were unbuilt.
				pickers: [...block.querySelectorAll('.input-root, .multi-icon-picker-root')].filter(el => !inMenu(el)).length,
			})),
		rows,
		// Every icon picker whose menu the walk below opens, in the document order the table prints,
		// marked in place. The driver addresses each one by the mark rather than by `nth()`, which
		// would mean two different queries agreeing on document order forever. `id` is the row's own
		// `block.n` — the identity `marks()` already prints — rather than a second notion of it.
		//
		// `shown` is read here rather than inferred from the `hide` class: a picker also disappears
		// when the `.consumes-row` around it hides, and hovering something with no box is a timeout
		// rather than a finding. It is printed either way, so a picker that vanishes on one build only
		// shows up as a diff rather than as a quiet skip.
		markMenus: () => {
			const found = [];
			for (const [index, block] of [...pane().querySelectorAll(q('content-block'))].entries()) {
				const owners = ownersOf(block);
				for (const [ordinal, el] of owners.entries()) {
					if (!MENU_KINDS.includes(kindOf(el))) continue;
					const row = rowOf(el, owners, ordinal, index);
					el.setAttribute('data-probe-menu', String(found.length));
					found.push({ mark: found.length, block: index, id: `${row.block}.${row.n}`, key: row.key, kind: row.kind, shown: el.getClientRects().length > 0 });
				}
			}
			return found;
		},
		// What one picker's menu holds, once it is there. The same `rowOf` the pane walk uses, so an
		// option reads exactly as it read when the baseline's eagerly built menus came out of the table
		// for free. `null` means the menu is not in the page — on this branch that is a picker that
		// failed to open, which is a finding, not a skip.
		menuRows: mark => {
			const menu = pane().querySelector(`[data-probe-menu="${mark}"]`)?.querySelector(MENU);
			if (!menu) return null;
			const owners = [...menu.querySelectorAll(OWNERS)];
			return owners.map((el, ordinal) => rowOf(el, owners, ordinal, null));
		},
		// `configureIconSection` hides the group when a spec declares no icon inputs and otherwise
		// writes an inline `gridTemplateColumns`. An inline style is invisible to `SERIALIZE`, which
		// only reads the class attribute, so nothing else would notice it going missing.
		playerIcons: () => {
			const group = pane().querySelector(':is([data-testid="player-icon-group"], .player-icon-group)');
			if (!group) return { present: false };
			return {
				present: true,
				hide: group.classList.contains('hide'),
				icons: [...group.querySelectorAll('.icon-picker-button')].filter(el => !inMenu(el)).length,
				gridTemplateColumns: group.style.gridTemplateColumns || '(none)',
			};
		},
		// The oracle for every interaction below, the same one talents.mjs uses: the autosaved blob is
		// what actually has to survive, and reading it instead of the picker's own DOM keeps the check
		// honest when the picker's markup is the thing being replaced.
		//
		// Every field is defaulted explicitly. The blob is proto JSON, so `false` and `0` are *omitted*
		// rather than written — `inFrontOfTarget` disappears when you untick it, and printing raw JSON
		// would show a key vanishing rather than a value changing.
		blob: () => {
			let saved = null;
			for (const key of Object.keys(localStorage)) {
				if (!key.endsWith('__currentSettings__')) continue;
				try {
					saved = JSON.parse(localStorage.getItem(key));
				} catch {
					// Not the blob we are after.
				}
			}
			if (!saved) return { error: 'no __currentSettings__ in localStorage' };
			const player = saved.player ?? {};
			const healing = player.healingModel ?? {};
			return {
				race: player.race ?? '(unset)',
				profession1: player.profession1 ?? '(unset)',
				profession2: player.profession2 ?? '(unset)',
				reactionTimeMs: player.reactionTimeMs ?? 0,
				distanceFromTarget: player.distanceFromTarget ?? 0,
				inFrontOfTarget: player.inFrontOfTarget ?? false,
				healingHps: healing.hps ?? 0,
				healingCadence: healing.cadenceSeconds ?? 0,
				healingAbsorbFrac: healing.absorbFrac ?? 0,
				enableItemSwap: player.enableItemSwap ?? false,
				consumables: JSON.stringify(player.consumables ?? {}),
				tanks: JSON.stringify(saved.tanks ?? []),
				raidBuffs: JSON.stringify(saved.raidBuffs ?? {}),
				debuffs: JSON.stringify(saved.debuffs ?? {}),
			};
		},
		// The showWhen pair, read as two numbers rather than as a boolean, so "the selector matched
		// nothing" cannot be mistaken for "it is shown".
		//
		// Chosen because the input that hides is not the input that changed — `#simui-profession1`
		// lives in the Player block and the Engineering consumables row lives in the Consumables one —
		// and because the single change drives *two* separate mechanisms a port could decouple:
		// the row toggles `hide` on the `.consumes-row` from its children's visibility, while the
		// picker's own `showWhen` toggles it on the explosives `.icon-enum-picker-root` inside it —
		// `ConsumesPicker.updateRow` and `Input.update` on the baseline, `ConsumeRow` and
		// `iconEnumPickerShown` in React. Keyed on the `.consumes-engi` class rather than the row's
		// "Engineering" label, which is i18n text.
		engineering: () => {
			const inputs = pane().querySelector('.consumes-engi');
			const row = inputs?.closest('.consumes-row');
			const picker = inputs?.querySelector('.input-root');
			return {
				profession1: document.getElementById('simui-profession1')?.value ?? null,
				profession2: document.getElementById('simui-profession2')?.value ?? null,
				rowHide: row ? row.classList.contains('hide') : null,
				pickerHide: picker ? picker.classList.contains('hide') : null,
			};
		},
	};
};

const browser = await launch();
// `openSpec` installs the strip probe, which is the only shape-agnostic way to open a tab: the two
// builds' tab strips are different markup.
const { page, errors } = await openSpec(browser, PORT, SPEC, { selector: q('sim-tabs') });
await page.evaluate(() =>
	window.simTabsProbe
		.tabs()
		.find(tab => window.simTabsProbe.idOf(tab) === 'settings-tab')
		?.click(),
);
await page.waitForSelector('#settings-tab .other-settings', { timeout: 60000, state: 'visible' });
// The blocks are built behind `sim.waitForInit()`, and the icon anchors get their wowhead action
// filled in asynchronously after that.
await page.waitForTimeout(2500);
await page.evaluate(INSTALL);

// Nothing printed may carry the port, or the two runs differ on the one thing that is meant to.
const normalise = line => String(line).replaceAll(`localhost:${PORT}`, 'localhost:<port>');
const say = line => console.log(normalise(line));
const problems = [];

say(`${SPEC} on :${PORT}\n`);

const blocks = await page.evaluate(() => window.settingsProbe.blocks());
say('blocks');
say(`  ${'column'.padEnd(20)} ${'block'.padEnd(22)} ${'title'.padEnd(30)} pickers  description`);
for (const block of blocks)
	say(`  ${block.column.padEnd(20)} ${block.name.padEnd(22)} ${block.title.padEnd(30)} ${String(block.pickers).padEnd(7)}  ${block.description || '-'}`);

say(`\nplayer icon group\n  ${JSON.stringify(await page.evaluate(() => window.settingsProbe.playerIcons()))}`);

// The full readout, keyed on id where there is one. A port that changes the markup around a
// generically-built input keeps this line identical; a port that renames the input, drops its label
// association, reformats its value or loses the `size` attribute does not.
const rows = await page.evaluate(() => window.settingsProbe.rows());
say(`\ninputs (${rows.length} pickers)`);
const flagsOf = row => [row.hide && 'HIDE', row.disabled && 'DISABLED', row.disabledAttr && 'disabled-attr'].filter(Boolean).join(' ') || '-';
const formatRow = row =>
	`${String(row.n).padStart(3)} ${('  '.repeat(row.depth) + row.key).padEnd(36)} ${row.kind.padEnd(24)} ${`"${row.label}"`.padEnd(26)} for=${row.htmlFor.padEnd(24)} ${row.value.padEnd(30)} ${flagsOf(row)}`;
for (const [index, block] of blocks.entries()) {
	say(`  [${block.name}] ${block.title}`);
	for (const row of rows.filter(entry => entry.block === index)) say(`    ${formatRow(row)}`);
}

// Pinned as a number so the pre-existing defect cannot grow unnoticed under a port.
// A dangling `for` — one naming an element that is not there — is the defect: vanilla writes the
// literal string `undefined` wherever an icon input's config has no id, and `PickerShell` omits the
// attribute instead. So the count falls as blocks port, which makes an exact expectation something
// that would need editing every time and a `must be zero` something that is not true yet.
//
// A ratchet instead. It may never rise on the React build, and lowering it is part of porting a
// block. Printed identically on both so this probe still matches across the ports.
const dangling = await page.evaluate(
	() => [...document.querySelectorAll('.settings-tab label[for]')].filter(label => !document.getElementById(label.getAttribute('for'))).length,
);
// At 0 this is an equality: no label in the React pane names anything that is not there. Measured
// on eleven specs across ten classes — three of them build no player icon inputs at all, one builds
// only an `icon`, and seven build the ported `IconEnumPicker`. The buffs and debuffs port is what
// took the `for="undefined"` icon labels this tracked; the player port found none left to take, so
// this is the earlier port's slack rather than a count this one moved. Raising it means a port put
// one back.
const REACT_DANGLING_MAX = 0;
const danglingOk = IS_BASE ? dangling > 0 : dangling <= REACT_DANGLING_MAX;
say(`  labels naming nothing: ${danglingOk ? 'as-recorded' : `UNEXPECTED(${dangling})`} — falls as blocks port; see REACT_DANGLING_MAX`);
if (!danglingOk)
	problems.push(
		IS_BASE
			? `the baseline has no labels naming nothing — the defect this ratchet tracks is gone, so it and REACT_DANGLING_MAX can go too`
			: `${dangling} labels name nothing, above the recorded ceiling of ${REACT_DANGLING_MAX} — a port put one back, or lower the ceiling if it removed some`,
	);

// Ids have to be unique for the readout above to mean anything: `configureInputSection` builds every
// input from a config that names its own id, so a port that duplicates one makes `document
// .getElementById` — and every `for=` in the pane — resolve to whichever came first.
const ids = rows.map(row => row.controlId).filter(Boolean);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicates.length) problems.push(`duplicate control ids: ${[...new Set(duplicates)].join(', ')}`);
const broken = rows.filter(row => row.htmlFor.startsWith('BROKEN'));
if (broken.length) problems.push(`label points at another control on: ${broken.map(row => row.key).join(', ')}`);

// The other two thirds of this tab: every `IconEnumPicker` option and every `IconPicker` a
// `MultiIconPicker` keeps behind its dropdown. The table above cannot reach them any more — see the
// header — so they are read one picker at a time here.
//
// **The React side is driven and the baseline is read where it stands.** Vanilla's `<ul
// class="dropdown-menu">` and every option in it is built in the picker's constructor and left in the
// page; that is not an accident of this gate's timing, it is the property `dropEagerMenus` asserts
// twice over before taking those menus off the baseline's tree in `parity.mjs`. So there is nothing
// to drive there: clicking Bootstrap's toggle as well would make this gate depend on `data-bs-toggle`
// mechanics that the port deletes, take a second round trip per picker, and reveal markup that is
// already in front of it. The port has no such option — a Base UI menu mounts when it opens — so the
// hover is on this side only. It is the same asymmetry the tree gates already split the two builds
// along, one helper per side, and the two readouts still have to come out byte for byte identical.
//
// Both pickers open on hover (`openOnHover delay={0}`), which is what `IconEnumPicker.test.tsx` and
// `MultiIconPicker.test.tsx` drive with `mouseEnter` + `mouseMove`. `a.icon-picker-button` inside the
// root is the trigger and, at rest, the only one there — the options wear the same class, and they do
// not exist yet.
//
// One plain hover per picker, wherever it sits. The pickers low in the 1280x720 window used to need
// centring and up to three goes, because `Menu.Positioner` defaulted to `positionMethod="absolute"`
// and Base UI's own `fixed`-until-positioned step then had Floating UI hand it viewport coordinates
// to apply inside a `position: relative` picker root — the popup landed a screenful away for a frame,
// the focus Base UI moves into it dragged `.sim-ui` to its maximum, and the trigger went out from
// under the pointer. `positionMethod="fixed"` on both pickers settles it, and the scaffolding is gone
// so the next regression of that shape shows up here instead of being driven around.
const openMenu = async at => {
	await page.locator(`${at} a.icon-picker-button`).first().hover();
	// `attached`, not `visible`: the assertion is that the menu is in the page, and a positioner
	// mid-transition is not something this readout should race.
	return page.waitForSelector(`${at} ul`, { state: 'attached', timeout: 3000 }).then(() => true, () => false);
};
const menuPickers = await page.evaluate(() => window.settingsProbe.markMenus());
const menus = [];
for (const picker of menuPickers) {
	const at = `[data-probe-menu="${picker.mark}"]`;
	if (picker.shown && !IS_BASE) {
		await openMenu(at);
		// `useActionId` resolves the option icons after the menu mounts, and `fill()` can move the
		// wowhead href with `spellIdTooltipOverride`. The baseline's have been settled since load.
		await page.waitForTimeout(200);
	}
	const options = picker.shown ? await page.evaluate(mark => window.settingsProbe.menuRows(mark), picker.mark) : null;
	menus.push({ ...picker, options });
	if (picker.shown && !IS_BASE) {
		// Off the trigger first, because `openOnHover` reopens it otherwise, then Escape for the case
		// where the pointer left but the menu stayed. Left open, a menu would land back in every
		// `rows()` the interactions below read.
		await page.mouse.move(0, 0);
		await page.keyboard.press('Escape');
		await page.waitForSelector(`${at} ul`, { state: 'detached', timeout: 15000 }).catch(() => {});
	}
}

const optionsOf = menu => menu.options ?? [];
const examined = menus.reduce((total, menu) => total + optionsOf(menu).length, 0);
const opened = menus.filter(menu => menu.options).length;
const skipped = menus.filter(menu => !menu.shown).length;
say(`\nmenus (${opened} opened, ${skipped} not shown, ${examined} options)`);
for (const [index, block] of blocks.entries()) {
	const here = menus.filter(menu => menu.block === index);
	if (!here.length) continue;
	say(`  [${block.name}] ${block.title}`);
	for (const menu of here) {
		const what = !menu.shown ? 'not shown' : menu.options ? `${menu.options.length} options` : 'NO MENU';
		say(`    ${menu.id.padStart(5)} ${menu.key.padEnd(34)} ${menu.kind.padEnd(24)} ${what}`);
		for (const row of optionsOf(menu)) say(`        ${formatRow(row)}`);
	}
}

// The floor, so a walk that stopped looking fails instead of printing a shorter list on both builds.
// Every number is computed from the tree rather than typed in — a literal would be this spec's, and
// the gate takes a spec argument — and each says something a smaller one does not:
//
//  - a pane with no icon pickers at all is not a pass, it is a selector that stopped matching;
//  - every picker that is on screen must have yielded a menu, so a hover that silently did nothing is
//    a finding rather than one fewer row;
//  - an icon-enum menu must hold options and a multi-icon menu must hold both its clear anchor and at
//    least one nested `IconPicker`. Without the second half, a port that stopped rendering the 36
//    nested pickers would still show a clear anchor per menu and pass;
//  - two rows per opened picker is the structural minimum either kind can have — vanilla's `showWhen`
//    will not even render an `IconEnumPicker` unless one of its values carries an actionId, so the
//    zero option is never alone, and a `MultiIconPicker` with no inputs has nothing to clear.
if (!menuPickers.length) problems.push('no icon pickers in the settings pane — the menu walk covered nothing');
for (const menu of menus) {
	if (!menu.shown) continue;
	if (!menu.options) {
		problems.push(`${menu.id} ${menu.key}: did not open — its menu is not in the page`);
		continue;
	}
	const options = menu.options.filter(row => row.kind === 'icon-dropdown-option').length;
	const nested = menu.options.filter(row => row.kind === 'icon-picker-root').length;
	if (!options) problems.push(`${menu.id} ${menu.key}: opened to no options at all`);
	else if (menu.kind === 'multi-icon-picker-root' && !nested) problems.push(`${menu.id} ${menu.key}: opened to its clear anchor and no IconPicker`);
}
if (opened + skipped !== menuPickers.length) problems.push(`opened ${opened} of the ${menuPickers.length - skipped} icon pickers on screen`);
if (examined < opened * 2) problems.push(`${examined} option rows across ${opened} menus — below two per menu, which every kind has`);

// The walk only hovers, so the pane has to come back exactly as it was: `blob at rest` below is read
// after it and is the reference every interaction restores to.
const afterMenus = await page.evaluate(() => window.settingsProbe.rows());
if (JSON.stringify(afterMenus) !== JSON.stringify(rows)) problems.push('opening the icon menus changed the pane — everything below starts from somewhere else');

const blob = () => page.evaluate(() => window.settingsProbe.blob());
const printBlob = async label => {
	const now = await blob();
	say(`\n${label}`);
	for (const [key, value] of Object.entries(now)) say(`  ${key.padEnd(20)} ${value}`);
	return now;
};
const atRest = await printBlob('blob at rest');
if (atRest.error) problems.push(atRest.error);

// Everything below reads the DOM *and* the blob, because either alone can lie: the picker can show a
// value it never wrote, and the blob can hold a value the picker never shows.
const marks = rowSet => rowSet.filter(row => row.hide).map(row => `${row.block}.${row.n} ${row.key}`);
const disabledMarks = rowSet => rowSet.filter(row => row.disabled || row.disabledAttr).map(row => `${row.block}.${row.n} ${row.key}`);
const delta = (before, after) => {
	const gained = after.filter(entry => !before.includes(entry));
	const lost = before.filter(entry => !after.includes(entry));
	return [gained.length ? `+[${gained.join(', ')}]` : '', lost.length ? `-[${lost.join(', ')}]` : ''].filter(Boolean).join(' ') || 'none';
};

let previous = rows;
let previousBlob = atRest;
// One step of the sequence: do it, then say what moved in the DOM and what moved in the blob. Only
// the changed blob fields are printed, so a step that writes nothing is visible as such rather than
// buried in fifteen unchanged lines.
const step = async (label, action) => {
	await action();
	await page.waitForTimeout(700);
	const now = await page.evaluate(() => window.settingsProbe.rows());
	const nowBlob = await blob();
	const changed = Object.entries(nowBlob)
		.filter(([key, value]) => value !== previousBlob[key])
		.map(([key, value]) => `${key}=${value}`);
	say(`  ${label.padEnd(28)} blob: ${changed.join(' ') || '(nothing changed)'}`);
	say(`  ${' '.repeat(28)} hide: ${delta(marks(previous), marks(now))}`);
	say(`  ${' '.repeat(28)} disabled: ${delta(disabledMarks(previous), disabledMarks(now))}`);
	previous = now;
	previousBlob = nowBlob;
	return { rows: now, changed };
};
const valueOf = (rowSet, key) => rowSet.find(row => row.key === key)?.value ?? 'NO ROW';

say('\ninteractions');

// The Other block is where `configureInputSection` builds a spec's inputs from its `InputConfig`
// array, so one control from it stands for all of them — but *which* controls are there is the
// spec's choice, and naming one turned a run on a caster into a stack trace (`in-front-of-target`
// is a melee input). Both representatives are found in that block instead, and a spec that offers
// none is a problem rather than a silent skip.
//
// The preference order is not cosmetic. `blob()` prints a fixed set of fields, and a control that
// writes somewhere it does not print — `stanceSnapshot` goes to `player.armsWarrior.options` — makes
// its step say "(nothing changed)" on both builds and diff clean, which is a check that measures
// nothing. Preferring a blob-backed control is what keeps the "the blob moved" assertion below
// satisfiable instead of a spec-dependent coin toss; the fallback still runs, and still fails loudly.
//
// `challenge-mode` is excluded on purpose: it rescales every equipped item, which is a far bigger
// interaction than this gate wants to take a picture of.
const otherBlock = blocks.findIndex(block => block.name === 'other-settings');
const BLOB_BACKED = ['in-front-of-target', 'distance-from-target', 'input-delay', 'channel-clip-delay', 'enable-item-swap'];
const pick = kind => {
	const candidates = rows.filter(row => row.block === otherBlock && row.kind === kind && row.controlId && row.controlId !== 'challenge-mode' && !row.hide);
	return candidates.find(row => BLOB_BACKED.includes(row.controlId)) ?? candidates[0] ?? null;
};
// A step whose whole point is the write: if the autosaved settings did not move, the picker is
// wired to nothing (or to a field this reader cannot see), and either way the step proved nothing.
const requireWrite = (result, what) => {
	if (!result.changed.length) problems.push(`${what} changed nothing in the autosaved settings — that step covered nothing`);
	return result.rows;
};

// A boolean.
const boolean = pick('boolean-picker-root');
if (boolean) {
	let after = requireWrite(await step(`click label[for=${boolean.controlId}]`, () => page.click(`label[for="${boolean.controlId}"]`)), `clicking #${boolean.controlId}`);
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, boolean.key)}`);
	after = requireWrite(await step('click it back', () => page.click(`label[for="${boolean.controlId}"]`)), `clicking #${boolean.controlId} back`);
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, boolean.key)}`);
	if (valueOf(after, boolean.key) !== boolean.value) problems.push(`clicking #${boolean.controlId} twice did not restore it`);
} else {
	problems.push('no boolean input in the Other block — the boolean interaction covered nothing');
}

// A number. `NumberPicker` commits on `change`, not on `input`, and reformats on the way back in
// (a float picker renders `30` as `30.00`), so both the blob and the rendered string are read. The
// original is restored from what the picker showed rather than from a constant, because the default
// differs per spec.
const number = pick('number-picker-root');
if (number) {
	const original = number.value.match(/^"([^"]*)"/)?.[1] ?? '0';
	const setNumber = async value => {
		await page.fill(`#${number.controlId}`, value);
		await page.locator(`#${number.controlId}`).dispatchEvent('change');
	};
	let after = requireWrite(await step(`#${number.controlId} = 30`, () => setNumber('30')), `setting #${number.controlId}`);
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, number.key)}`);
	after = requireWrite(await step(`#${number.controlId} = ${original}`, () => setNumber(original)), `restoring #${number.controlId}`);
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, number.key)}`);
	if (valueOf(after, number.key) !== number.value) problems.push(`restoring #${number.controlId} did not restore its rendered value`);
} else {
	problems.push('no number input in the Other block — the number interaction covered nothing');
}

// A select, and the `enableWhen` wiring at the same time: the healing-model inputs are enabled only
// while the player is one of the raid's tanks, so unassigning the tank must disable four inputs it
// does not itself contain, and reassigning it must enable exactly those again.
//
// Only on a tank. `TankAssignment` carries `threat-metrics`, which the shell hides by CSS on a spec
// with threat metrics off — no `hide` class, so the table above cannot show it and Playwright will
// not click it. That is exactly why this defaults to `warrior/protection`: on a DPS spec the whole
// enableWhen half of this gate covers nothing, and the skip line says so out loud rather than
// leaving a silent gap.
if (await page.locator('#tank-assignment').isVisible()) {
	const enabledBefore = disabledMarks(previous);
	let after = (await step('#tank-assignment = None', () => page.selectOption('#tank-assignment', '-1'))).rows;
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, 'tank-assignment')}`);
	if (disabledMarks(after).length <= enabledBefore.length) problems.push('unassigning the tank disabled nothing — the enableWhen wiring covered nothing');
	after = (await step('#tank-assignment = Main Tank', () => page.selectOption('#tank-assignment', '0'))).rows;
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, 'tank-assignment')}`);
	if (disabledMarks(after).join() !== enabledBefore.join()) problems.push('reassigning the tank did not re-enable exactly what unassigning it disabled');
} else {
	say('  #tank-assignment             SKIPPED: hidden by .threat-metrics on this spec — no enableWhen coverage here');
}

// An icon input. Two thirds of this tab's pickers are icons with no id and no form control at all,
// and a click on one is the only way to see whether it still writes anything. Bloodlust is in the
// External Damage Cooldowns block on every spec that has one; clicking twice must return the blob to
// where it started, the same way item-swap.mjs proves the swap button is its own inverse.
const BLOODLUST = '#settings-tab a[href$="spell=2825"]';
if (await page.locator(BLOODLUST).count()) {
	let after = requireWrite(await step('click Bloodlust icon', () => page.click(BLOODLUST)), 'clicking the Bloodlust icon');
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, 'spell=2825')}`);
	after = requireWrite(await step('click it again', () => page.click(BLOODLUST)), 'clicking the Bloodlust icon again');
	say(`  ${' '.repeat(28)} dom:  ${valueOf(after, 'spell=2825')}`);
	if (previousBlob.raidBuffs !== atRest.raidBuffs) problems.push('clicking Bloodlust twice did not restore raidBuffs');
} else {
	problems.push('no Bloodlust icon in the settings pane — the icon interaction covered nothing');
}

// showWhen, asserted rather than recorded. A probe that only prints `rowHide` passes just as happily
// when the selector matches nothing and it prints `null` on both builds; the expectation below is
// computed from the two profession selects, so a missing row fails instead of reading as shown.
//
// `null` means "not in the tree", which is how the port hides a row — so the two builds print
// different values here on purpose, `true` against `null`, and only the derived shown/hidden answer
// is asserted. A selector that matches nothing still fails, because it reads as hidden in the
// direction the row is meant to be shown.
say('\nshowWhen: #simui-profession1 -> the Engineering consumables row');
const ENGINEERING = '4';
const checkEngineering = async label => {
	await page.waitForTimeout(700);
	const state = await page.evaluate(() => window.settingsProbe.engineering());
	const expectShown = state.profession1 === ENGINEERING || state.profession2 === ENGINEERING;
	say(
		`  ${label.padEnd(28)} prof1=${String(state.profession1).padEnd(3)} prof2=${String(state.profession2).padEnd(3)} expect=${(expectShown ? 'shown' : 'hidden').padEnd(6)} rowHide=${String(state.rowHide).padEnd(5)} pickerHide=${state.pickerHide}`,
	);
	for (const [name, hidden] of [
		['row', state.rowHide],
		['picker', state.pickerHide],
	]) {
		if ((hidden === false) !== expectShown) problems.push(`${label}: the Engineering ${name} should be ${expectShown ? 'shown' : 'hidden'} and is not`);
	}
	return state;
};
await checkEngineering('at rest');
await page.selectOption('#simui-profession1', '1');
await checkEngineering('prof1 = Alchemy');
await page.selectOption('#simui-profession1', ENGINEERING);
await checkEngineering('prof1 = Engineering');
// Both directions from a starting point the spec did not choose: without this, a spec that already
// defaults to Engineering only ever proves the class comes back.
await page.selectOption('#simui-profession2', ENGINEERING);
await page.selectOption('#simui-profession1', '1');
await checkEngineering('only prof2 = Engineering');
await page.selectOption('#simui-profession2', '1');
await checkEngineering('neither is Engineering');

say('');
for (const problem of problems) say(`  PROBLEM ${problem}`);
for (const error of errors) say(`  ERROR ${error}`);
say(problems.length || errors.length ? `${problems.length} problem(s), ${errors.length} error(s)` : 'ok');
await page.close();
await browser.close();
process.exit(problems.length || errors.length ? 1 : 0);
