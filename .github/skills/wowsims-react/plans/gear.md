# Gear port plan — read-only investigation, 2026-09-07

Worktree `~/personal/wowsims-mop-react`, branch `feature/ui-react`, HEAD `512faf7a6`. Nothing was
modified. All line numbers are the working tree as read.

**Investigation note.** A large parallel merge (the log-pipeline rewrite) landed in this worktree
mid-investigation. Every file this plan cites was re-checked afterwards: gear's 16 views,
`gear_tab.ts`, `ui/scss/core/components/gear_picker/`, `base_modal.tsx`, `ui/ui-kit/Dialog/` and
`tools/react-migration/` are **untouched** by it, so those citations hold. Two things did move and
are cited in their post-merge form: `ui/ui-kit/virtual_list.ts` grew 175 → 236 lines (shared-scroller
support), and `results/view/log_runner.tsx` is deleted, replaced by
`results/view/log/log_view.tsx`.

Headline: **`item_list.tsx` is rebuilt in React on `@tanstack/react-virtual`, together with
`selector_modal.tsx`, as the feature's last unit.** The library is a hook API and both current
`VirtualList` consumers are vanilla classes, so adopting it and porting the view are the same unit —
and `item_list`'s panes live inside the vanilla modal, so the modal has to go first or with it. The
modal's three blockers — a missing `Tabs` primitive, a `Dialog` with nowhere to put the slot rail,
and a `PORTED_DIALOGS` count that varies per spec — are therefore scheduled prerequisites, not
reasons to defer. **Five smaller units land first**, and the one fact that makes the rebuild cheap is
that no `ItemList` markup is compared by any gate (section 6).

## 1. Map

`gear_tab.ts` builds the pane (`ui/app/tabs/gear_tab.ts:40-45`): `GearPicker`, the three summary
blocks, `PresetConfigurationPicker`, one `SavedDataManager`.

| File | Lines | What it renders | Subscribes to | Writes to the store | External consumers |
|---|---|---|---|---|---|
| `view/item_list.tsx` | 811 | One selector tab pane: filter bar (`:145-160`), sortable header row (`:161-192`), `<ul>` driven by `VirtualList` (`:237-247`), and each row (`:496-534`) | none of its own; driven by `selector_modal.tsx:703-707` | `sim.setFilters` (`:586`, favourite toggle); `bt.addItem/removeItem` (`:623`) | `GearData` type only → `bulk_item_picker.tsx:14`, `icon_item_swap_picker.tsx:12`, `gear_picker.tsx:12` |
| `view/selector_modal.tsx` | 736 | `BaseModal` (`:86`, `xl`, `disposeOnClose:false`); title + inner Bootstrap tab strip inserted into `this.header` (`:96-102`); tab content (`:104`); the 16-icon slot rail prepended to `this.dialog` (`:302-346`); a "missing gear" note (`:110-118`) | `gearData.subscribe` `:703`, `subscribeSimField(sim,'phase')` `:705`, `…'filters'` `:706`, `subscribeUiField(sim,'showEPValues')` `:707`, `gearData.subscribe` per gem tab `:426` | via `gearData.equipItem` only — `player.equipItem` (`gear_picker.tsx:162`) or `itemSwapSettings.equipItem` (`icon_item_swap_picker.tsx:81`) | **class** → `bulk_tab.tsx:50,86,222`; `SelectorModalTabs` → `bulk_item_picker.tsx:16`; `getTranslatedTabLabel` → `item_list.tsx:34` |
| `view/gear_picker.tsx` | 215 | `.gear-picker-root` with a left/right column (`:51-56`) and 16 `ItemPicker`s (`:58-62`); constructs the shared `SelectorModal` (`:64`) | per picker: `'gear'` `:119`, `sim 'filters'` `:134`, `ui 'showQuickSwap'` `:144`, `subscribeAll(profession1, profession2)` `:152` | none directly; `createGearData().equipItem` → `player.equipItem` (`:162`) | `gear_tab.ts:6,58`; `selector_modal.tsx:23` (**cycle**, see seam (f)) |
| `view/item_renderer.tsx` | 253 | The equipped-item cell: icon, ilvl badge, name row, enchant/tinker/reforge labels, gem sockets (`:70-86`) | `createItemSockets`' profession subscription, owned and disposed (`:112-113`, `:170`) | none — render only | `bulk_item_picker.tsx:15,42`; `bulk_sim_results_renderer.tsx:16,126`; `gear_picker.tsx:13,93` |
| `view/gear_elements.tsx` | 84 | `getEmptySlotIconUrl`, `createNameDescriptionLabel`, `createGemContainer`, `setGemInContainer`, `createItemSockets` | `subscribeAll(profession1, profession2)` inside `createItemSockets` (`:77`), handed back to the caller | none | `bulk_item_search.tsx:18`; five files inside gear |
| `view/gear_change_icon.tsx` | 129 | A read-only diff cell: icon, reforge marker, changed sockets, with tippy per change (`:73,113`) | none | none | **`reforge_panel.tsx:29,929`**, `bulk_sim_results_renderer.tsx:15,120` |
| `view/filters_menu.tsx` | 310 | `BaseModal` (`:23`, `md`, `disposeOnClose:false`) of vanilla `NumberPicker`/`EnumPicker`/`BooleanPicker`, in hand-built sections (`:298-309`) | every picker: `subscribeSimField(sim,'filters')` | `sim.setFilters` from every picker | `item_list.tsx:31,230` only |
| `view/quick_swap.tsx` | 125 | The favourites popover's tippy content — title, list, empty message, footer button (`:74-123`) | none | none — `onItemClick` is the caller's | `quick_gem_popover.ts:6`, `quick_enchant_popover.ts:7`, `gear_picker.tsx:16` |
| `view/quick_enchant_popover.ts` | 48 | Binds `QuickSwapList` for enchants/tinkers | reads `sim.getFilters().favoriteEnchants` at build (`:23`) | `player.equipItem` (`:41`) | `gear_picker.tsx:14` |
| `view/quick_gem_popover.ts` | 48 | Binds `QuickSwapList` for gems | reads `sim.getFilters().favoriteGems` (`:24`) | `player.equipItem` (`:41`) | `gear_picker.tsx:15` |
| `view/icon_item_swap_picker.tsx` | 87 | One item-swap slot icon + sockets (`:30-34`); constructs **its own** `SelectorModal` (`:39`) | `subscribePlayerField(player,'itemSwap')` `:48` | `itemSwapSettings.equipItem` (`:81`) | **`ItemSwapPicker.tsx:3`** (React, `useLegacyMount`) |
| `view/item_notice.tsx` | 105 | A warning triangle with a tippy (`:75-79`); `registerSetBonusNotices` static (`:84`) | none | mutates the module map `ITEM_NOTICES` (`:101`) | **`individual_sim_ui.tsx:23,225`**, `item_list.tsx:646`, `item_renderer.tsx:212` |
| `view/item_notices.tsx` | 102 | The notice data: `ITEM_NOTICES`, `SET_BONUS_NOTICES`, `MISSING_RANDOM_SUFFIX_WARNING` | none | none | `item_notice.tsx:9`, `item_renderer.tsx:17` |
| `view/gem_summary.tsx` | 117 | `ContentBlock` + one row per distinct gem + a reset button (`:94-108`) | `subscribePlayerField(player,'gear')` `:37` | `player.setGear(…withoutGems)` `:103` | `gear_tab.ts:7,52` |
| `view/reforge_summary.tsx` | 133 | `ContentBlock` + one row per reforged stat + a `CopyButton` (`:85`) + reset (`:109`) | `subscribePlayerField(player,'gear')` `:36` | `player.setGear(…withoutReforges)` `:119` | `gear_tab.ts:8,53` |
| `view/upgrade_costs_summary.tsx` | 188 | `ContentBlock` + one row per currency + "upgrade all" (`:135`) + reset (`:165`) | `subscribeAll(gear, race)` `:63` | `player.setGear` `:153`, `:174` | `gear_tab.ts:9,54` |

**Reach-ins that decide unit order**

| Site | What it needs |
|---|---|
| `ui/app/individual_sim_ui.tsx:225` | `ItemNotice.registerSetBonusNotices(this.sim.db)` — a static on a view class, called from the shell. Must survive as a plain function or the shell cannot call it after the class goes |
| `ui/features/bulk/view/bulk_tab.tsx:222` | `new SelectorModal(rootElem, simUI, player, undefined, { id: 'bulk-selector-modal' })` — bulk is un-ported, but this instance **cannot** stay vanilla: it would keep `selector_modal`, `item_list`, `filters_menu` and `virtual_list.ts` alive. Unit 4 narrows it to an opener so 6d can hand it the React controller |
| `bulk_item_picker.tsx:42,139-168,178` | `ItemRenderer`, `SelectorModalTabs`, `GearData`, and `bulkUI.selectorModal.openTab(...)` |
| `bulk_sim_results_renderer.tsx:120,126` | `buildGearChangeIcon`, `ItemRenderer` |
| `reforge_panel.tsx:929` | `buildGearChangeIcon` — reforge is un-ported |
| `ItemSwapPicker.tsx:48` | `new IconItemSwapPicker(parent, host, player, slot)` inside `useLegacyMount` — already the island shape |

**Row counts** (`assets/database/db.json`, 14,944 items). Per `ItemType`: weapons 1,829 · legs 1,474 ·
chest 1,468 · head 1,384 · hands 1,378 · waist 1,102 · feet 1,060 · trinkets 837 (two slots) · rings
663 (two slots). Non-item tabs are bounded by the whole table: gems 186, enchants 255, random
suffixes 451 (filtered to one item's options, in practice 5–8), reforges ≤56 (~10 per item),
upgrades ≤4.

## 2. Seams, in order of preference

**(a) Model seam — available, and the largest in the feature.** ~250 DOM-free lines:

| What | Lines |
|---|---|
| `sortIdxs` (favourites-first, EP-then-ilvl, ilvl) | `item_list.tsx:431-461` |
| the search predicate | `item_list.tsx:357-403` (take the query and a `getNpc`/`getZone` pair as callbacks) |
| `isItemFavorited` and the favourite-key switch | `item_list.tsx:652-667`, `:540-571` |
| `getItemIdByItemType` | `item_list.tsx:293-312` |
| the trinket/upgrade sort-by rule | `item_list.tsx:405-410` |
| the tab-eligibility fallback to Items | `selector_modal.tsx:159-167` |
| the six `itemData` builders, minus their three JSX `name` fields | `selector_modal.tsx:178-199, 218-239, 254-275, 445-479, 504-530, 556-581` |
| upgrade-cost totals | `upgrade_costs_summary.tsx:78-98` + `COSTS` `:18-43` |
| gem counting / reforge totalling | `gem_summary.tsx:47-60`, `reforge_summary.tsx:42-55` |

Precedent `features/stat-weights/model/`; `ui/features/*/model/**` is lint-enforced DOM-free
(`.oxlintrc.json`). Moving `GearData`, `ItemData`, `ItemListType`, `SelectorModalTabs` and
`getTranslatedTabLabel` out at the same time **breaks the `item_list` ↔ `selector_modal` import
cycle** (`item_list.tsx:34` ↔ `selector_modal.tsx:24`) and gives bulk a stable import.

**(b) Tab-body seam — available.** `ui/app/tabs/gear_tab.ts` is a shell file in `app/tabs`, the
category `SKILL.md:988-1000` says is editable. It is 107 lines and follows exactly the shape
`settings_tab.tsx` (306 → 18) and `talents_tab.tsx` did.

**(c) React shell + vanilla body islands (`AdvancedEncounterModal` shape) — technically available for
`SelectorModal`, and deliberately not taken.** `SKILL.md:930-937` rules that shape out for
`EpWeightsMenu` because it builds against `this.body`/`this.footer`/`this.header`. `ItemList`'s
constructor takes a `parent` and appends to it (`item_list.tsx:88-103`, `:197`) and it has a real
`dispose()` (`:289-291`), so `useLegacyMount` could host it with no refactor of a vanilla view —
this feature has the seam stat-weights lacked. **The user rejected it on 2026-09-07**: a rebuild is
preferred over hosting the imperative list inside a React shell, and two virtualisers in the tree at
once is not acceptable. Recorded because it is a real option, and because the reasoning for
declining it is a preference for a clean port rather than a technical impossibility — worth knowing
if the schedule ever needs a cheaper intermediate step.

**(d) Whole-view port (talents/settings shape) — available for four views, blocked for one.**
Available: the three summary blocks (all three React twins exist — `ContentBlock`, `Button`, `Icon`;
`CopyButton` stays vanilla behind `useLegacyMount`, as `Exporter.tsx:46` and `TalentsPicker.tsx:32`
already do), and `FiltersMenu` (every picker in it has a React twin, and it has no islands at all).
Blocked for `SelectorModal`: its own shell needs three things that do not exist (section 6).

**(e) Opener seam — available, precedent `epWeightsModal: { open(): void }`
(`sim_host.ts:53`).** `GearPicker.selectorModal` (`gear_picker.tsx:43`) and
`BulkTab.selectorModal` (`bulk_tab.tsx:86`) are only ever called as
`.openTab(slot, tab, gearData)` (`gear_picker.tsx:187`, `bulk_item_picker.tsx:139,147,156,168`,
`icon_item_swap_picker.tsx:44`). Narrowing both to `{ openTab(slot, tab, gearData): void }` lets a
React controller replace the class later without touching bulk.

**(f) The `SelectorModal` ↔ `GearPicker` cycle — a seam that has to be *cut*, not used.**
`addItemSlotTabs` (`selector_modal.tsx:297-347`) reaches into `gearPicker.itemPickers` and reads
`picker.slot` (`:307`), `picker.item` (`:325-326`), `picker.onUpdate` (`:337`) and
`picker.openSelectorModal` (`:315`); `GearPicker` constructs the modal (`gear_picker.tsx:64`) and
`ItemPicker` calls back into it (`:187`). Neither can port while the other holds a concrete
reference to it. The rail's data is four fields — slot, current item, an update subscription, an
open callback — so the cut is a `SlotRailEntry[]` the picker hands over, not a refactor.

**(g) Body-island seam for `FiltersMenu` — not available and not needed.** Its body is 14 vanilla
pickers built directly into sections it makes itself; there is no "build into this element"
function. But every one of those pickers has a React twin, so the whole view ports instead.

## 3. Recommended units, smallest first

### Unit 1 — model and types extraction. No React in the change.

`ui/features/gear/model/`: `item_sort.ts` (a), `item_search.ts` (a), `favourites.ts` (a),
`item_ids.ts` (a), `tab_eligibility.ts`, `item_data.ts` (the six builders, taking their `name` as a
`string | HTMLElement` the view supplies), `summary_totals.ts`. Plus `ui/features/gear/types.ts` for
`GearData` / `ItemData` / `ItemListType` / `SelectorModalTabs` / `getTranslatedTabLabel`.

Pin **current** behaviour including the quirks — defects 3, 12 and 21 below all live in this code and
are unit 3's or a later unit's to fix, not this one's.

Same fork stat-weights unit 1 had, and it must be decided before starting:
- **(i) edit the vanilla views** to import from `model/`. Smallest total work; defended by
  `parity.mjs` / `panes-parity.mjs` staying byte-identical (no DOM moves) and by the new tests.
- **(ii) land `model/` + tests with the views untouched**, and switch consumers in the unit that
  deletes each view. Costs one duplicated copy for the length of the port.

- Gate: new vitest suite; `npm run test:unit`; type-check; oxlint (the `no-restricted-globals`
  override on `ui/features/*/model/**` is what proves it is DOM-free); `parity.mjs` and
  `panes-parity.mjs` byte-identical; goldens byte-identical.
- Dialog: not needed.

### Unit 2 — the gear tab body, the three summaries, and `GearPicker` as one island.

`gear_tab.ts` 107 → ~18 lines, registering the pane and owning nothing else.
`features/gear/components/GearTabBody/` renders `.gear-tab-left` / `.gear-tab-right` and
`.summary-tables-container`; `GemSummary`, `ReforgeSummary` and `UpgradeCostsSummary` become React on
`ContentBlock`; `GearPicker`, `PresetConfigurationPicker` and the `SavedDataManager` mount through
`useLegacyMount`, exactly as `SettingsTabBody.tsx` does.

`ItemNotice.registerSetBonusNotices` (`item_notice.tsx:84`) moves to
`features/gear/model/set_bonus_notices.ts` as a plain function, and `individual_sim_ui.tsx:225`
calls that. `SET_BONUS_NOTICES` is `new Map([])` today (`item_notices.tsx:102`), so the function
currently does nothing — do not delete it on that basis, it is data-driven.

**This unit is gated on defect 7.** `useLegacyMount`'s cleanup calls `dispose()`, and `GearPicker`
registers none of its four per-picker subscriptions (`gear_picker.tsx:119,134,144,152`) for
disposal. Under the dev server's StrictMode double-mount — which is what `mount-once.mjs` runs
against, per `SKILL.md:1123-1127` — the first `GearPicker`'s 64 subscriptions keep firing into a
detached tree. Either register them in the same commit (a one-line-per-subscription edit to a
vanilla view) or make this unit conditional on unit 5 landing first.

- Gate: `panes-parity.mjs` on `#gear-tab` (this is the pane both tree gates see — section 4);
  `parity.mjs`; `mount-once.mjs` against `:3403`, explicitly, for the reason above; goldens
  byte-identical; a new `tools/react-migration/gear-tab.mjs` in the `settings-tab.mjs` mould
  (the three summaries' rows and reset buttons, "upgrade all", the copy button's clipboard payload).
- Dialog: not needed.

### Unit 3 — `FiltersMenu` on the `Dialog` adapter, as-is.

The cheapest dialog in the feature and the right one to prove the stylesheet merge at, for a reason
worth naming: **`FiltersMenu` does not exist at page load.** It is constructed inside `ItemList`'s
constructor (`item_list.tsx:230`), which runs from `addTab` → `setData` → `openTab`
(`selector_modal.tsx:649, 174, 124`), and `openTab` only runs on a click. So `parity.mjs` sees zero
of them and `PORTED_DIALOGS` needs no entry — the whole gate complication that blocks
`SelectorModal` is absent here.

Mapping onto `Dialog.tsx`: `size:'md'` (`filters_menu.tsx:23`) → `size`; `title` → `title`;
`disposeOnClose:false` → `keepMounted`; `'filters-menu'` → `cssClass`; parent `simUI.rootElem` →
`container={host.rootElem}`. Nothing else is used. Opened from the still-vanilla `ItemList` through a
small controller with `subscribe`/`open()`, the `ImportExportRegistry` shape
(`app/header/import_export_registry.ts:19-42`), read with `useSyncExternalStore` — the same
arrangement `EpWeightsDialog` uses. Rendering it from `GearTabBody` rather than inside the selector
modal's tab content also retires defect 6 by construction.

SCSS: `ui/scss/core/components/gear_picker/_filters_menu.scss` (52 lines) →
`FiltersMenu.scss`. Two things die under the Dialog's markup and must move in the same commit:
`.filters-menu .modal-body { gap }` (`:2-4`) — `Dialog.scss` already sets `gap` on
`.sim-dialog-body`, so this one may need nothing, as stat-weights unit 4 found; and
`var(--bs-modal-padding)` (`:31`, `:44`) is emitted inside `.modal` only, so it resolves to nothing
in a portaled popup. `--modal-padding` is the seam token, same value. This is the exact trap
`_exporters.scss` hit for real (change log, 2026-09-06).

- Gate: a new `tools/react-migration/filters-menu.mjs` that opens the gear selector, clicks
  Filters on both builds and contrasts the section list, every picker's id and value, and the
  computed `gap`/`grid-column-gap` (the `--bs-modal-padding` check); `npm run test:unit`;
  `parity.mjs` unchanged (nothing at load); goldens byte-identical.
- Dialog: **as-is**.

### Unit 4 — cut the `SelectorModal` ↔ `GearPicker` cycle and narrow the opener.

- `sim_host`-style narrowing: `GearPicker.selectorModal` and `BulkTab.selectorModal` typed
  `{ openTab(slot, tab, gearData): void }`. `bulk_item_picker.tsx` and `icon_item_swap_picker.tsx`
  compile unchanged.
- `SelectorModal`'s constructor takes a `slotRail?: SlotRailEntry[]` — `{ slot, getItem, onUpdate,
  open }` — instead of a `GearPicker`, and `gear_picker.tsx:64` builds the array. `addItemSlotTabs`
  (`:297-347`) then names nothing from gear's own view layer, and `switchToPrevious/NextItemSlotTab`
  (`:359-373`) index that array instead of `gearPicker.itemPickers`.

- Gate: type-check; `parity.mjs` and `panes-parity.mjs` byte-identical (the rail's markup does not
  move); a browser probe that opens the gear selector and walks the rail with ArrowUp/ArrowDown on
  both builds; goldens byte-identical.
- Dialog: not needed.

### Unit 5 — `ItemCell`, and `GearPicker` in React.

`ui/features/gear/components/ItemCell/`. **What it parameterises** — the axes the survey
(`~/.claude/plans/based-on-feature-ui-restructure-start-vast-yeti.md:260`, "7 of 9") found varying:

| Axis | Who varies it |
|---|---|
| icon element and how the image is set — `<a>` background / `<img src>` / `<div>` background | `item_renderer.tsx:74` vs `item_list.tsx:503` vs `gear_change_icon.tsx:29-35` |
| ilvl badge present, and whether it carries the `+N` upgrade span | `item_renderer.tsx:73,152-161` vs `item_list.tsx:499` vs `bulk_item_search.tsx:180` |
| name row: plain string, `HTMLElement`, quality class, name-description label | `item_renderer.tsx:198-219`, `item_list.tsx:504-507`, `quick_swap.tsx:96-98`, `gem_summary.tsx:70` |
| the enchant / tinker / reforge label stack — present or absent | only `item_renderer.tsx:81-83` |
| sockets — interactive, decorative, or absent | `item_renderer.tsx:75` vs `gear_change_icon.tsx:38` vs `icon_item_swap_picker.tsx:32` |
| a trailing action slot | `item_list.tsx:513-533` (EP, favourite, compare), `gem_summary.tsx:72` (count) |

**What it fixes**: the class vocabulary (`item-picker-root`, `-icon-wrapper`, `-ilvl`,
`-sockets-container`, `-name-row`, `-name-container`, `-labels-container`) and the nesting order.

Nine sites hold that shape: `item_renderer.tsx:70-86`, `item_list.tsx:496-534`,
`gear_change_icon.tsx:26-41`, `icon_item_swap_picker.tsx:30-34`, `selector_modal.tsx:302-321`,
`bulk_item_search.tsx:175-190`, `quick_swap.tsx:85-101`, `gem_summary.tsx:66-74`,
`glyphs_picker.tsx:142,156`. **It absorbs only gear's own**, and only those whose owner is React by
then: `GearPicker`/`ItemPicker`. The vanilla `ItemRenderer` class stays untouched and dual-stack —
`bulk_item_picker.tsx:42` and `bulk_sim_results_renderer.tsx:126` are un-ported callers, and
`glyphs_picker.tsx` is a talents island. That is the dual-stack rule, not a compromise.

The quick-swap popovers port with this unit (they are built from `ItemPicker`,
`gear_picker.tsx:199,212`) onto `Tooltip` + `openOnClick:false` + `clickable`. See section 5 for how
the recorded stale-closure bug is kept fixed.

- Gate: `panes-parity.mjs` + `parity.mjs` with `INTENDED` entries for every markup line the port
  changes — and this is the pane that is compared twice (risk 1); an `ItemCell.parity.test.tsx`
  using `mountBoth` against the vanilla `ItemRenderer`; `sidebar-popover.mjs`-style browser probe for
  the quick-swap tooltips (react-tooltip renders in place — `.item-picker-labels-container` is a new
  container, so measure it once, and note that both vanilla popovers pass
  `appendTo: document.querySelector('.sim-ui')` — `quick_enchant_popover.ts:18`,
  `quick_gem_popover.ts:20` — for which react-tooltip has no equivalent);
  `item-swap.mjs` unchanged on both builds (it never opens a selector modal, so it is unaffected);
  goldens byte-identical.
- Dialog: not needed.

### Units 6a–6c — the three prerequisites, each independently landable.

Promoted from "why the modal is blocked" to scheduled work by the user's decision to port
`item_list` properly. Each is small, each is gate-only or `ui-kit`-only, and none of them touches
gear.

- **6a — `ui/ui-kit/Tabs/`**, a Base UI `Tabs` adapter with a registry row. See blocker 1.
- **6b — `Dialog` gains a slot for content outside the body**, or the rail moves and
  `_gear_picker.scss:153-188` is re-keyed. See blocker 2 — this is a decision before it is a commit
  (open question 6).
- **6c — `parity.mjs`'s `PORTED_DIALOGS` accepts a per-spec count.** Gate-only, no product code.
  See blocker 3.

  Gates: 6a — unit tests plus `unused.mjs` (a `ui-kit` component with no importer must be excused
  there until 6d lands). 6b — `parity.mjs` and `panes-parity.mjs` byte-identical, since no shipped
  dialog changes shape. 6c — verified by tightening a count and watching it fail, the way
  `['exporter', 6]` → `5` was checked.

### Unit 6d — `SelectorModal` + `ItemList`, ported together. The feature's last and largest unit.

`item_list` cannot be separated from the modal (see the verdict in section 6), and the modal cannot
land before 6a–6c. What makes the pairing tractable rather than merely large is the asymmetry the
gates create: the **modal shell** is byte-compared at load and every line of it is expensive, while
the **list** is invisible to both tree gates and can be rebuilt freely.

**6d must take bulk's and item-swap's instances too, or it does not achieve what it is for.**
`bulk_tab.tsx:222` and `icon_item_swap_picker.tsx:39` construct the **vanilla class**, which
constructs vanilla `ItemList` (`selector_modal.tsx:649`), which constructs `VirtualList`. Leaving
either behind keeps `selector_modal.tsx`, `item_list.tsx`, `filters_menu.tsx` **and**
`virtual_list.ts` alive as dual-stack files with no end date short of the bulk port — precisely the
coexistence the user rejected. Unit 4 already provides the escape: both call sites are narrowed to
`{ openTab(slot, tab, gearData) }`, so in 6d they receive the React controller off the host instead
of constructing anything. One line each.

What that buys, and it is more than avoiding a rule violation: **one** React dialog replaces
`2 + itemSwapSlots.length` vanilla instances. So 6c's assertion becomes "baseline
`2 + itemSwapSlots.length`, React exactly 1", `PORTED_DIALOG_REACT` moves by 1 rather than by N,
there is **no** `VANILLA_ON_BOTH` entry, and all three vanilla files are genuinely deleted. Two more
entries for the "does not survive" table follow from it: `randomUUID()` tab ids
(`selector_modal.tsx:91`) existed only so several instances could coexist in one document, and
`disposeOnClose: false` (`:86`) preserved only the shell — `setData` rebuilt the contents on every
open anyway. A React dialog should therefore **not** `keepMounted` nine virtualised lists.

- Gate: `parity.mjs` with 6c's per-spec baseline count against a single React portal;
  `panes-parity.mjs` unchanged (it never sees the modals);
  a new `tools/react-migration/selector-modal.mjs` opening the modal on both builds and contrasting
  the tab set, the rail's active slot, ArrowUp/ArrowDown navigation, search, sort, favourite toggle
  and equip; `gear-selector-timing.js` against its pre-port baseline; `npm run test:unit`; goldens
  byte-identical.
- Dialog: **extended by 6b**.

**Why the modal is the hard half — the three blockers, now 6a–6c's briefs:**

1. **No `Tabs` primitive exists.** `ui/ui-kit/` has no `Tabs` folder and the registry has no row;
   `SimTabs.tsx` uses Base UI `Tabs` directly at app level, against `SimTabRegistry`.
   `selector_modal.tsx:626-640` emits `data-bs-toggle="tab"` and `item_list.tsx:144` emits
   `tab-pane fade active show`, and `SKILL.md:133-136` names this strip as one of the three that
   still need `.nav-link` / `.tab-pane` / `.fade` / `.show` and the Bootstrap plugin. A React strip
   that Bootstrap then mutates is the failure `SKILL.md:502-506` forbids, and the tab set here is
   rebuilt mid-session by `removeTabs`/`addGemTabs` (`:674-689`), so it is a harder shape than the
   top-level strip. **This is the primitive that does not exist yet.**
2. **`Dialog` has nowhere to put the slot rail.** `.gear-picker-modal-slots` is prepended to
   `this.dialog` (`selector_modal.tsx:302`) — a sibling of `.modal-content` inside `.modal-dialog` —
   and `shared/_modal.scss:2-4` makes `.modal-dialog` `display: flex`, so the rail is a flex column
   to the left of the content box. `Dialog` merges `.modal-dialog` and `.modal-content` into one
   `.sim-dialog-popup` (registry row, `Dialog.tsx:61`), so that slot does not exist. Either `Dialog`
   gains an outside-the-body slot (a `ui-kit` change with a registry row and a change-log entry) or
   the rail moves inside the popup and `_gear_picker.scss:153-188` is re-keyed — a visual change,
   not a port. `_gear_picker.scss:169` also reads `--bs-modal-border-color`, which is emitted inside
   `.modal` only.
3. **`PORTED_DIALOGS` cannot express the count.** `.selector-modal` instances at load =
   `2 + itemSwapSlots.length` (gear picker `gear_picker.tsx:64`, bulk `bulk_tab.tsx:222`, one per
   swap slot `icon_item_swap_picker.tsx:39` via `ItemSwapPicker.tsx:48`). Across the six gate specs
   that is **6, 6, 10, 6, 6, 6** — `hunter/beast_mastery` declares eight swap slots
   (`ui/sims/hunter/beast_mastery/spec.ts:50-58`). `PORTED_DIALOGS` entries are `[marker, integer]`
   and `takeModals` (`parity.mjs`) fails on `!==`, so the gate needs a per-spec count or a predicate
   — the same escape hatch `INTENDED` has in its `match(base, react)` form — **before** any of this
   can land.

One thing 6d avoids by taking all three call sites: `.selector-modal` never becomes dual-stack, so
unlike `.exporter` and `.importer` there is no `VANILLA_ON_BOTH` entry and no stylesheet worn by
both stacks at once. And `_selector_modal.scss`
selects `.modal-header` (`:6`) and reads `--bs-modal-header-padding-y` (`:35`),
`--bs-modal-padding` (`:49`) and `--bs-nav-link-padding-{x,y}` (`:15-17`) — four component-scoped
families, all of which stop resolving under `Dialog` + a Base UI strip.

## 4. Risks

**Risk 1 — the gear pane is the only pane both tree gates see, so it is pinned twice.** `parity.mjs`
serialises the whole page at load and gear is the tab that is open then (`panes-parity.mjs`'s header
comment says so outright); `panes-parity.mjs` then opens each tab and serialises `#gear-tab` again.
Every markup line unit 2 and unit 5 change therefore needs an `INTENDED` entry that both gates
observe, and `INTENDED` fails as loudly when a divergence is *not* seen as when an unrecorded one is
(`SKILL.md:893-899`). The modals are **not** in this: they are appended to `simUI.rootElem`, outside
`#gear-tab`, so only `parity.mjs` sees them — and at load they hold only the shell, the rail and the
"missing gear" note, because `setData` has never run.

**Risk 2 — `filters` is a hot subscription, and it is the shape the progress-callback rule warns
about.** One click on a favourite star writes `sim.setFilters` (`item_list.tsx:586`), which rings
`subscribeSimField(sim,'filters')` on **every open tab** (`selector_modal.tsx:706`), each of which
re-runs `applyFilters` — a full re-filter, a full re-sort of up to 1,800 indices and a
`scroller.update()`. A React list bound to `filters` must memoise a row on
`(id, favourite, active, epDelta)`; a naive binding re-renders every mounted row across nine tabs on
every star click. This is not the progress-callback constraint (`SKILL.md:1152-1162`) — gear has no
progress callback at all — but it is the same "the store is written constantly, keep reactivity
per-component" shape, and `SKILL.md:440-445` already records that a bound picker re-renders on every
notification from its source whether or not its value changed.

**Risk 3 — `useLegacyMount` + StrictMode against the un-disposed subscriptions.** Covered under
unit 2; repeated here because it is the one risk that can make a *green* unit wrong in the dev
server only. `SelectorModal.dispose()` is called from nowhere in the tree (verified), so its
`addOnDisposeCallback`s at `:426` and `:709-715` are unreachable code today; the moment `GearPicker`
lives inside a ref callback that disposes on cleanup, that stops being harmless.

**Risk 4 — frozen surfaces.** `ui/sims/**` and `ui/features/spec_config.ts` are read only:
`itemSwapSlots` (`spec_config.ts:154`), `presets.gear` (`gear_tab.ts:91`), `defaults.gear`
(`individual_sim_ui.tsx:399`). None of them changes. A spec-file diff in any of these units is a
reject.

**Risk 5 — a defect vanilla shares cannot be fixed while the parity gate pins vanilla's markup.**
`SKILL.md:1623-1626` names this set. Gear adds members: the `<label>` inside `<a>`
(`item_list.tsx:504`), the seven `href="javascript:void(0)"` anchors, and the `hide`-class idiom on
`item_list.tsx:153,154,191,529` and `gem_summary.tsx:28`. Anything inside a *modal* is exempt —
`parity.mjs` removes ported dialogs from both trees by count, so nothing inside them is compared
(that is how stat-weights fixed sixteen defects), but nothing inside `#gear-tab` is.

**Risk 6 — `ItemRenderer` stays alive after unit 5**, because two of its three callers are in
un-ported bulk. Expect `.item-picker-*` to be dual-stack the way `.exporter` and `.importer` are,
and check the squatters before co-locating any of it (`SKILL.md:1093-1097`): `bulk_item_search.tsx:180`
uses `item-picker-ilvl`, `glyphs_picker.tsx:142,156` uses `item-picker-root` and
`item-picker-name-container`, `gear_change_icon.tsx:27,31,38` and `icon_item_swap_picker.tsx:32`
reuse three more.

## 5. The quick-swap / favourite path

**The recorded stale-closure bug is already fixed in the tree**, at `quick_enchant_popover.ts:36-42`
and `quick_gem_popover.ts:36-42` — `onItemClick` reads `player.getEquippedItem(itemSlot)` at click
time rather than using the `EquippedItem` captured when the popover was built. The comments there say
why. The fix arrived with the master merge (`96b9ee5a8`).

The port keeps it by **never letting an `EquippedItem` into a closure at all**:

- `onItemClick` reads through `usePlayer().getEquippedItem(slot)` inside the handler, as today.
- `active` (`quick_enchant_popover.ts:33`, `quick_gem_popover.ts:33`) is derived at render from
  `useStoreSubscribe(subscribePlayerField(player,'gear'), () => player.getEquippedItem(slot))`, not
  from a captured `currentItem`.
- With both of those, `QuickSwapList.item` (`quick_swap.tsx:34,66`) and the whole
  refresh-by-identity dance in `ItemPicker` disappear: `gear_picker.tsx:127`
  (`this._equippedItem !== this.quickSwapEnchantPopover?.item`), `:128`, `:139-141` and the
  `quickSwapGemPopover = []` reset at `:175` are all bookkeeping that exists only because the list
  holds a snapshot.
- The favourite list is the same shape one level down: `getItems` reads
  `sim.getFilters().favoriteEnchants` / `.favoriteGems` at build time
  (`quick_enchant_popover.ts:23`, `quick_gem_popover.ts:24`) and is refreshed by
  `gear_picker.tsx:134-142`'s `filters` subscription calling `update()`. In React that is a second
  `useStoreSubscribe` on `subscribeSimField(sim,'filters')` and the `update()` path goes away too.
  `Sim.getFilters()` returns `DatabaseFilters.clone(...)` (`ui/domain/sim.ts:952-955`), so this is
  **not** the `ListPicker` in-place-mutation trap (`SKILL.md:1166-1171`) — the snapshot is safe to
  hold between notifications.

**The test that proves it**, mutation-checked: mount the popover, write a different item into the
slot through the store, click a favourite, and assert the resulting `equipItem` call carries the
*new* item's enchant/gem set. Reverting to a captured item must fail exactly that assertion.

## 6. What blocks what

| Unit | `Dialog` | Other primitives |
|---|---|---|
| 1 — model + types | not needed | none |
| 2 — tab body + summaries | not needed | `ContentBlock`, `Button`, `Icon` (all built); `CopyButton` stays vanilla behind `useLegacyMount` |
| 3 — `FiltersMenu` | **as-is** | `NumberPicker`, `EnumPicker`, `BooleanPicker` (all built); an opener controller, the `ImportExportRegistry` shape |
| 4 — cycle cut + opener | not needed | none |
| 5 — `ItemCell` + `GearPicker` | not needed | **`ItemCell` — new**; `Tooltip` (built); `useActionId` (built) |
| 6a — `ui-kit/Tabs/` | not needed | Base UI `Tabs` (the dependency is already in) |
| 6b — `Dialog` outside-body slot | **it is the change** | none |
| 6c — per-spec dialog count | not needed | gate-only |
| 6d — `SelectorModal` + `ItemList` | **extended by 6b** | 6a, 6c; **`@tanstack/react-virtual` — not installed**; `ItemCell` from unit 5 |

### The verdict on `item_list.tsx`: **React + `@tanstack/react-virtual`, rebuilt, in unit 6d.**

Decided by the user 2026-09-07, overriding this plan's first draft (which said island) and
overriding the coexistence option. Two virtualisers in the tree at once is rejected: `virtual_list.ts`
is replaced, not shadowed. What follows is the evidence for the shape and the sequencing, not a
re-argument of the decision.

**Why it cannot be its own unit.** `@tanstack/react-virtual` is a hook API — `useVirtualizer` /
`useWindowVirtualizer` — and a hook cannot be called from a vanilla class. `ItemList` is one
(`item_list.tsx:66`), and its panes are built into the vanilla `SelectorModal`'s
`.selector-modal-tab-content` (`selector_modal.tsx:651`), a Bootstrap `.tab-pane` container that
`setData` wipes and rebuilds on **every open** (`:144-145`) and whose tab set changes mid-session
(`:674-689`). So React can only own the list once React owns the modal. Adopting the library and
porting the modal are the same unit of work. That is why unit 6d below absorbs `item_list` and why
its three prerequisites are promoted from blockers to scheduled work.

**The fact that frees the rebuild, verified rather than assumed: no `ItemList` markup is compared by
any gate, ever.**

- `panes-parity.mjs` serialises `'#' + id` — the `SimTab` root. The selector modals are appended to
  `simUI.rootElem` (`gear_picker.tsx:64`, `icon_item_swap_picker.tsx:39`, `bulk_tab.tsx:222`),
  **outside** `#gear-tab`. It never sees them.
- `parity.mjs:121` serialises `.sim-ui` at load and `:124` pulls every `.modal` subtree out with
  `collectSubtrees` (`browser.mjs:593-604`), comparing them as a sorted set, byte-for-byte per modal
  (`:215-219`). So the modal **shell** is strictly pinned.
- But `setData` (`selector_modal.tsx:143`) — the only thing that ever constructs an `ItemList`
  (`:649`) — runs only from `openTab` (`:124`), and every `openTab` caller is a click handler
  (`gear_picker.tsx:187`, `icon_item_swap_picker.tsx:44`, `bulk_item_picker.tsx:139,147,156,168`).
  At load `.selector-modal-tab-content` is **empty**.

So the 811 lines of `item_list.tsx` produce **zero gate-visible markup**, and a ground-up React
rebuild of the list costs **zero `INTENDED` entries**. This is the opposite of the rest of the gear
feature: `#gear-tab` renders at load and is the one pane both tree gates see (risk 1). What *is*
pinned is the modal shell — the rail, the header, the empty `<ul class="nav nav-tabs">` and the
"missing gear" note — which is unit 6d's other half and is not free at all.

**What survives the rebuild and what does not.** The distinction the rebuild turns on:

| Vanilla does this | Because | Verdict |
|---|---|---|
| `itemData: Array<ItemData<T>>` built eagerly per tab (`selector_modal.tsx:178-199` etc.) | the feature needs a stable, sortable, filterable projection of the DB | **survives** — it becomes unit 1's `model/item_data.ts` |
| `itemsToDisplay: Array<number>` — indices into `itemData` (`item_list.tsx:235,414`) | avoids copying row objects when the imperative code re-sorts | **survives**, as a memo returning the filtered+sorted array |
| `updateVisible(row => patch active / EP delta)` (`item_list.tsx:320-337`, `virtual_list.ts:138-140`) | the DOM was the model: only mounted rows could be patched, so equipping an item reached into them | **does not survive** — `active` and the EP delta are derived per row from `useStoreSubscribe(gearData.subscribe, …)`. This is the single largest simplification in the port |
| `dataset.idx` on every row (`:497`) and `parseFloat(dataset.idx)` to read it back (`:321-322`) | the same thing: the index had to round-trip through the DOM | **does not survive** |
| `dataset.fav` read back to decide the next toggle (`:585,588,602`) | ditto | **does not survive** — favourites are `useStoreSubscribe(subscribeSimField(sim,'filters'), …)` |
| `hideOrShowEPValues` writing `style.display` on `.ep-label` and a `hide-ep` class (`:463-477`) | no reactive binding existed | **does not survive** — one `useStoreSubscribe(subscribeUiField(sim,'showEPValues'))` and a conditional class |
| `sizeRefresh()` on `shown.bs.tab` (`selector_modal.tsx:720-722`) | the list could not measure itself in a hidden pane | **does not survive** if panes stay mounted; `react-virtual` re-measures on its own observer |
| `keepParity` filler (`virtual_list.ts:190`) | `:nth-child(2n)` striping (`_item_list.scss:85-91`) flips when the window starts on an odd row | **survives as a requirement, not as a filler** — express striping from the virtual index (`--row-parity`, or `even`/`odd` classes), which is strictly better |
| the 10-row overscan (`virtual_list.ts:13`) | fast scroll shows gaps otherwise | **survives** — `overscan: 10` |
| single measured `rowHeight` (`:194,226-235`) | it was cheap | **replace with `estimateSize` + `measureElement`** — see the measurement note below |
| favourites sorted first, then EP-or-ilvl (`:453-460`) | the feature needs it | **survives** — unit 1's `item_sort.ts` |

**Row heights — measure before choosing `estimateSize` alone or `measureElement`.**
`.selector-modal-list-item` has no fixed height (`_item_list.scss:78-83`: `padding: .5rem`, flex),
but it contains a 3rem icon (`:148-153`), so rows are floored at ~64px and are *probably* uniform —
`estimatedRowHeight: 56` (`item_list.tsx:244`) is already wrong, which is why `VirtualList`
re-measures. Rows that could exceed the floor: a wrapping name at 1.125rem plus a
`nameDescription` label (`:504-507`), a two-line source cell (`:716-723`), a two-line random-suffix
name (`selector_modal.tsx:462-467`), and an `ItemNotice` triangle (`item_list.tsx:646-647`). If a
browser check shows them uniform, `estimateSize: () => 64` is enough and `measureElement` is cost
for nothing; if not, `measureElement` fixes an approximation `VirtualList` cannot express. **This is
a browser measurement, not a reading — do not decide it from the SCSS.**

**Scroller mode is static per call site, so the two-hook API is not a problem.**
`virtual_list.ts` resolves its scroller at runtime (`:110-116`: given up front, else
`findScrollParent`, else `window`) because one class serves two call sites with different modes.
Each React call site knows its mode at compile time: gear scrolls in its own box
(`.selector-modal-list`, `max-height: 60vh; overflow-y: scroll`, `_item_list.scss:61-66`) →
`useVirtualizer` with `getScrollElement`. The page-scrolled log needs `useWindowVirtualizer`, whose
`scrollMargin` is the documented equivalent of `virtual_list.ts:198-216`'s
`visibleTop − contentElem.getBoundingClientRect().top` arithmetic — **stated from the library's
published API, not verified against an installed copy, because it is not installed** (below). Verify
it against the real package before the log port relies on it; it is the one feature of
`virtual_list.ts` most likely to lack a direct equivalent.

**`@tanstack/react-virtual` is not installed.** Absent from `dependencies` and `devDependencies` in
`package.json`, and `node_modules/@tanstack` does not exist. Adoption is a new-dependency decision
and should be argued the way `SKILL.md:454-479` argued react-query — except that the two verdicts
come out opposite ways, and the reason is worth writing down: react-query was declined because it
had **no React consumer** and its configuration would have been all-off. This has a React consumer
the moment unit 6d lands, its whole configuration is load-bearing (`count`, `estimateSize`,
`overscan`, `getScrollElement`), and it replaces a module rather than adding a layer. The rule
`SKILL.md:477-479` states — adopt when a primitive gains its *first* React consumer — is satisfied
here and was not there.

**Deleting `virtual_list.ts` is gated on three consumers, and this plan accounts for one.**

| Consumer | Status |
|---|---|
| `ui/features/gear/view/item_list.tsx:19,83,237` | **unit 6d** — this plan, and only if 6d also takes bulk's and item-swap's `SelectorModal` instances (above); leaving either vanilla keeps this consumer alive |
| `ui/features/results/view/log/log_view.tsx:6,31,125` | results feature, hands-off (`SKILL.md:956-962`); relocated onto this branch by the in-flight merge |
| `ui/features/results/view/timeline/rotation/rotation_view.tsx` (381 lines) | does **not** virtualise today; the user wants it to. An addition, not a replacement |

So `virtual_list.ts` survives unit 6d and is deleted only when results ports. That is not the rejected
coexistence option — that was "keep both indefinitely as a dual-stack pair". This is one module on
its way out with a named end date, the same shape `view/exporter.tsx` and `view/importer.tsx` are in.

**Perf is the acceptance criterion, and the number does not exist yet.** `tools/browser-perf/` holds
three protocols — `reference-swap-timing.js`, `apl-edit-timing.js`, `spec-sweep.js` — and **none of
them opens the gear selector** (`tools/browser-perf/README.md:11-19`). So a
`gear-selector-timing.js` has to be written and baselined on the current build *before* the port,
or there is nothing to show non-regression against. Model it on `apl-edit-timing.js`, which is the
closest analogue (a large list plus an edit) and whose recorded row is the format to match:
`README.md:31`, *APL numeric edit (sync / DOM mutations): 137–144 ms / 30,357 → 8–10 ms / 3,109*.

What it should measure, on the slot with the largest pool — main hand, **1,820 items** for a warrior
after phase and class-allowlist filtering (below):

1. cold open of the gear selector from the Items tab: sync click cost, settle to last DOM mutation, mutation count, long tasks;
2. typing four characters into the search box — the worst case, because every keystroke re-runs `applyFilters` (`item_list.tsx:282`) over the whole pool;
3. a favourite-star click, which writes `sim.setFilters` (`:586`) and re-runs `applyFilters` on **every open tab** (`selector_modal.tsx:706`) — risk 2's shape, and the number most likely to move;
4. scrolling the list to the bottom: frames, mutation count, and peak row count in the DOM.

**Row counts in practice**, computed from `assets/database/db.json` (14,944 items) with
`canEquipItem`'s real gates — `classAllowlist` (`ui/domain/proto_utils/items.ts:34`),
`armorTypes[0] >= item.armorType` (`:70`) — and `phase <= CURRENT_PHASE` (`Phase5`,
`ui/domain/constants/other.ts:12`, applied at `item_list.tsx:360`):

| slot | warrior (plate) | mage (cloth) |
|---|---|---|
| Head / Shoulder / Chest / Legs | 692 / 673 / 776 / 682 | 190 / 190 / 205 / 170 |
| Wrist / Hands / Waist / Feet | 775 / 772 / 769 / 798 | 218 / 211 / 225 / 222 |
| Neck / Back | 459 / 411 | 461 / 414 |
| Finger / Trinket | 571 / 828 | 570 / 825 |
| Weapon *(before the per-class weapon-type gate)* | 1,820 | 1,819 |

The other eight tabs are bounded by tables that are small outright: gems 186, enchants 255, random
suffixes 451 in total but 5–8 per item, reforges ≤56 (~10 per item), upgrades ≤4. **Virtualisation is
load-bearing for the Items tab and inherited noise on the other eight** — so the React list should
take a `virtualise` decision from the row count rather than always windowing, or accept ~250 mounted
rows on the enchant tab. Either is defensible; say which in the PR.

## 7. Defects noticed — recorded, not fixed

Batch into one `AskUserQuestion` per `SKILL.md:1002-1009`. Several are user-visible, which is
unusual for this list.

**Certainly wrong, user-visible**

1. `item_list.tsx:368-369` — the search reads `listItemData.name.toString()`, but `name` is an
   `HTMLElement` on three tabs (`selector_modal.tsx:462-467, 509-518, 563-568`). `toString()` on a
   div is `"[object HTMLDivElement]"`, so **search on the Random Suffix, Reforging and Upgrades tabs
   matches nothing** for any query. Same class as the `description` trap at `SKILL.md:428-430`.
2. `item_list.tsx:405-410` — `applyFilters` overwrites `sortBy` unconditionally, and it runs on every
   search keystroke (`:282`), every `filters` change and every `phase` change
   (`selector_modal.tsx:705-706`). **Clicking the ilvl header to sort (`:163`) is silently undone by
   the next keystroke or any favourite toggle**; `sortDirection` survives, so the list lands on EP in
   whatever direction ilvl was left in.
3. `gear_picker.tsx:197` — `openGemDetailTab(0)` is a literal where `socketIdx` was computed one line
   above (`:194`) and is used correctly for the popover (`:199`). **Clicking any gem socket opens the
   Gem1 tab.**

**Leaks — every one of these is unbounded**

4. `selector_modal.tsx:426` and `:709-715` — `addOnDisposeCallback` is **unreachable**:
   `disposeOnClose: false` (`:86`) and nothing in the tree calls `SelectorModal.dispose()`
   (verified). Every `openTab` runs `setData` (`:143`), which builds 1–9 `ItemList`s, each with four
   store subscriptions (`:703-707`) and a `VirtualList` (a `scroll` listener and a `ResizeObserver`,
   `item_list.tsx:237-247`, `virtual_list.ts:73,81`), plus one gem-icon subscription per socket
   (`:426`). `setData` clears the DOM (`:144-145`) but releases none of it.
5. `item_list.tsx:619` — a per-**row** `subscribeBulkField(simUI.bt,'items')` whose unsubscribe is
   discarded; the comment at `:618` admits it. Rows are built on demand as you scroll
   (`virtual_list.ts:137`), so this grows with scroll distance.
6. tippy instances never destroyed when their anchor is dropped: `item_list.tsx:215` (per `ItemList`,
   and `ItemList`s are rebuilt on every `setData`), `:600` and `:605` (per row, and rows are
   recycled), `gear_picker.tsx:175` (`quickSwapGemPopover = []` drops the references without
   `destroy()`), `gear_change_icon.tsx:73,113`, `item_notice.tsx:77` (destroyed only in `dispose()`,
   which `item_list.tsx:646`'s instance never gets).
7. `item_notice.tsx:39` — `this.template` is a getter **with side effects** (it builds the button and
   the tippy at `:74-79`) and it is evaluated twice in the same statement:
   `if (this.hasNotice && this.template) this.rootElem.appendChild(this.template!)`. Two buttons and
   two tippy instances are created per notice; the first pair is orphaned immediately.
8. `gear_picker.tsx:119, 134, 144, 152` — four subscriptions per `ItemPicker`, ×16 pickers, none
   registered with `addOnDisposeCallback`. Harmless while the tab lives forever; a blocker for unit 2
   (risk 3).
9. `selector_modal.tsx:129-141` — `onShow` pushes two `addOnHideCallback`s per open, and
   `onHideCallbacks` is the caller's list, never cleared (`base_modal.tsx:139-141`, `:149`). Ten
   opens leave twenty removals of the same two listeners. The `base_modal` fix recorded in the change
   log reset `openCallbacks` only, which is the other list.
10. `item_list.tsx:230` — `new FiltersMenu(parent, …)` where `parent` is the selector modal's
    `.selector-modal-tab-content` (`selector_modal.tsx:651`), so a Bootstrap modal is built **inside
    another modal's body**, once per `setData`. Once more than one selector modal has been opened —
    the gear picker's, any swap slot's, bulk's — the ~14 filter picker ids
    (`filters_menu.tsx:31,47,59,87,108,134,159,179,193,209,223,248,268,282`, several of them
    per-value) are duplicated.

**Async / lifecycle hygiene**

11. `item_list.tsx:639-642` — `actionId.fill().then(...)` writes `anchorElem.value!` and
    `iconElem.value!.src` with no abort and no existence check, on a row `VirtualList` may already
    have recycled. `item_renderer.tsx:145-149` has the guard; this does not.
11a. `icon_item_swap_picker.tsx:39` and `gear_picker.tsx:64` — the `SelectorModal` each builds is
    appended to `simUI.rootElem`, outside the constructing component’s own `rootElem`, and is
    never `addChild`ed. `useLegacyMount`’s cleanup (`gearPicker.dispose(); rootElem.remove()`)
    therefore leaves the modal behind. **This is live today** for item swap, which
    `ItemSwapPicker.tsx:48` already mounts through `useLegacyMount`: under the dev server’s
    StrictMode double-mount each swap slot leaves an orphaned selector modal in `.sim-ui`. It
    becomes true for `GearPicker` the moment unit 2 mounts it the same way.
12. `icon_item_swap_picker.tsx:64` — `fillAndSetActionId` with no `AbortSignal`, where
    `item_renderer.tsx:53-54,124-125` maintains one for the same job.
13. `gear_tab.ts:89` and `gear_picker.tsx:97`, `icon_item_swap_picker.tsx:41` — floating
    `waitForInit().then(...)` with no `.catch`. Same shape the stat-weights port fixed.
14. `selector_modal.tsx:326-331` and `gear_elements.tsx:61` — the same unguarded
    `fill().then(write)` pattern.

**Dead code and dead CSS**

15. `item_list.tsx:803-810` — `bindToggleCompare` is one `classList.remove('hide')` and three
    commented-out lines. The compare column is unconditionally shown and
    `sim.getShowExperimental()` is never read. Called from `:200` and `:607`.
16. `item_list.tsx:635` — `if (event.target === favoriteElem.value) return false;` inside the
    **anchor's** click handler. The favourite button is a sibling of that anchor (`:524-528` vs
    `:502-508`), so the condition can never hold.
17. `_selector_modal.scss:34-40` — `.selector-modal .modal-header .btn-danger`. The only
    `.btn-danger` is the unequip button (`item_list.tsx:157`), which is inside a tab pane in the
    body. No element matches. Same category as stat-weights' dead `.pending`.
18. `upgrade_costs_summary.tsx:74` — `!!Object.keys(itemsWithUpgrade).length` on an array.
19. `item_list.tsx:751` — an assignment inside a condition:
    `(source = item.sources.find(...) ?? source).source.oneofKind === 'rep'`.

**HTML5 / a11y**

20. `item_list.tsx:504` — `<label class="selector-modal-list-item-name">` labels nothing and sits
    inside an `<a>`, which is interactive content inside a link.
21. `item_list.tsx:163, 183` — `<h6 onclick>`. A heading is not a control: no `role`, no `tabindex`,
    so sorting is keyboard-unreachable.
22. `<button>` with no `type`: `item_list.tsx:148, 157, 186, 525, 530`; `quick_swap.tsx:116`;
    `item_notice.tsx:75`; `gem_summary.tsx:95`; `reforge_summary.tsx:110`;
    `upgrade_costs_summary.tsx:135, 165`.
23. Icon-only buttons with no accessible name: `item_list.tsx:186` (the EP `?`), `:525` (favourite),
    `:530` (compare), `item_notice.tsx:75` (the warning triangle — its only content is FA classes).
24. `href="javascript:void(0)"`: `item_renderer.tsx:74, 79, 81, 82, 83`; `gear_elements.tsx:55`;
    `selector_modal.tsx:311`; `quick_swap.tsx:89`. React 19 substitutes a URL that **throws** when
    followed; the `IconEnumPicker` precedent (change log, 2026-09-06) is to omit the attribute and
    keep the element focusable with `nativeButton={false}`.
25. `filters_menu.tsx:302-307` — `section.innerHTML` with `${name}` interpolated, where `name` is a
    translation string. HTML from the locale file, in a tree that otherwise uses JSX.

**Untranslated English**

26. `item_list.tsx:601` ("Remove from favorites" / "Add to favorites"), `:613` ("Remove from Batch
    Sim" / "Add to Batch Sim"), `:680` ("World Drop"), `:690`/`:786` ("PVP"), `:702, 704, 719`
    ("Unknown"), `:741` ("Quest"), `:794` ("Sold by"); `selector_modal.tsx:339`
    (`Edit ${slotName}`), `:565` ("Base"); `item_notice.tsx:89`; the whole of `item_notices.tsx`.

**Not a defect — checked and cleared**

- `item_list.tsx:672` — `<a target="_blank">` with no explicit `rel`. The `@jsx-vanilla` runtime
  applies `externalRel` to every `<a href>` written as JSX (change log, 2026-09-06), and this is
  written as JSX, so it is covered.
- `icon_item_swap_picker.tsx:39` constructs its `SelectorModal` with no `id`, so
  `randomUUID()` (`selector_modal.tsx:91`) supplies non-deterministic tab ids. `SERIALIZE`
  (`browser.mjs:39-41`) excludes ids for exactly this reason, so no gate sees it.
- `Sim.getFilters()` clones (`ui/domain/sim.ts:952-955`), so the in-place `push`/`splice` at
  `item_list.tsx:574-578` and throughout `filters_menu.tsx` mutates a copy. Not the `ListPicker`
  trap.

## 8. Open questions

1. **Unit 1's fork (i) or (ii)** — edit the un-ported vanilla views to import from `model/`, or land
   `model/` beside a duplicated copy. Stat-weights took (i); the objection to it is the same one
   `SKILL.md:964-973` raises about rewriting un-ported feature views.
2. **Does unit 2 fix defect 8 in the same commit?** It is a subscription-disposal edit to a vanilla
   view, and unit 2 does not work correctly under `mount-once.mjs` without it. Fix-in-place, or
   reorder so unit 5 deletes `GearPicker` first and unit 2 lands afterwards?
3. **The three summary blocks render empty until the first `gear` notification** — `updateTable` is
   only called from the subscription (`gem_summary.tsx:37`, `reforge_summary.tsx:36`,
   `upgrade_costs_summary.tsx:63`) and `subscribeGated` does not fire on subscribe
   (`subscriptions.ts:31-32`). A React port renders from state on the first render, which is a
   silent improvement. `INTENDED`, or freeze the empty first paint?
4. **Which of the three user-visible defects (1, 2, 3) get fixed, and in which unit?** Defect 1's
   fix belongs in unit 1's `item_search.ts` (take a `searchText: string` alongside the display
   `name`); defect 2's in `item_sort.ts`; defect 3 is a one-character fix in a vanilla view. All
   three are inside `#gear-tab`'s or the modal's markup-free logic, so none of them needs an
   `INTENDED` entry.
5. **`parity.mjs`'s per-spec dialog count** — is widening `PORTED_DIALOGS` to accept a
   `count(spec)` predicate (the shape `INTENDED`'s `match` already has) acceptable as its own
   gate-only commit, as unit 6c? Without it `SelectorModal` cannot be gated at all.
6. **Does `Dialog` gain an outside-the-body slot, or does the slot rail move inside the popup?**
   The first is a `ui-kit` change with a registry row; the second is a visual change to a shipped
   layout. This decides unit 6b, and nothing before it.
7. **`ui-kit/Tabs` (6a) is built for one consumer.** The other two Bootstrap strips are
   `bulk_tab.tsx:219` and `detailed_results.tsx:122`, both in un-ported features, so gear is its only
   caller for a while — the "a React component with no consumer" case Phase 2's rule exists to
   prevent, run in reverse. Acceptable, or does 6d wait for bulk? `unused.mjs` will report it either
   way and needs an `ALLOWED` entry in the meantime.
8. **`@tanstack/react-virtual` is a new dependency** — not in `package.json`, not in
   `node_modules`. Approve the addition, and confirm the version to pin. Two follow-ons: whether the
   parallel `@tanstack/react-table` assessment lands first (one vendor family is an argument neither
   piece makes alone, but the table verdict is not in yet), and whether `useWindowVirtualizer`'s
   `scrollMargin` really covers the page-scrolled log — stated here from the library's published API,
   **not verified against an installed copy**.
9. **The perf baseline does not exist and has to be recorded before the port, not after.** No
   `tools/browser-perf/` protocol opens the gear selector. `gear-selector-timing.js` is therefore a
   prerequisite of 6d rather than part of it. Who runs it, and on which build — this agent is
   read-only and cannot run a browser.
10. **Does the React list window every tab, or only Items?** Eight of the nine tabs are ≤255 rows and
    six are under 60. Always-window is one code path; window-when-large is two but mounts ~250 fewer
    DOM nodes on the enchant tab. Cheap either way, but it should be a decision rather than a default.
11. **Should units 2 and 5 merge?** Unit 2 hosts `GearPicker` through `useLegacyMount`, which
    costs a throwaway fix to defect 8 and a second to defect 11a — both in code unit 5 deletes —
    purely to sequence. Merging them means `gear_picker.tsx` is never edited and never hosted, at
    the price of one larger unit landing the tab body and `ItemCell` together. Under the user’s
    port-properly direction the merge may be the intended reading; it is a scheduling call, not a
    technical one.
12. **Rebuild scope.** The verdict's table says what should not survive the port — the DOM-as-model
    round-trips (`dataset.idx`, `dataset.fav`, `updateVisible`, the `style.display` writes). Confirm
    that dropping them is wanted, since each is a behaviour the current build has and a reviewer
    diffing old against new will notice their absence.
