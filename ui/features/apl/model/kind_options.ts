import type { Player } from '@sim/player/player';

import { actionKinds, type APLActionKind } from './action_kinds';
import { type ValidAPLValueKind, valueKinds } from './value_kinds';

/**
 * One entry in a kind dropdown.
 *
 * Deliberately not `DropdownOption`: that type's `label` is a `ReactNode`, and this file is model.
 * It is structurally assignable to one, which is what lets the pickers pass the array straight
 * through while the dependency arrow keeps pointing the right way.
 */
export interface KindOption<K> {
	value: K;
	label: string;
	submenu?: Array<string>;
	/** HTML, authored here — never by a user. The picker's shared tooltip renders it. */
	tooltip?: string;
}

/** `<p>short</p> full`, or just the short description — the tooltip for both kind pickers. */
const kindTooltip = (shortDescription: string, fullDescription: string | undefined): string =>
	fullDescription ? `<p>${shortDescription}</p> ${fullDescription}` : shortDescription;

/**
 * The value kinds a player may pick, in the table's own insertion order.
 *
 * `isPrepull` and `isGroup` are the list's property, not the picker's, so they arrive through
 * `AplScopeContext` rather than being read off the DOM.
 */
export const valueKindOptions = (player: Player<any>, isPrepull: boolean, isGroup: boolean): Array<KindOption<ValidAPLValueKind>> =>
	(Object.keys(valueKinds) as Array<ValidAPLValueKind>)
		.filter(kind => valueKinds[kind].includeIf?.(player, isPrepull, isGroup) ?? true)
		.map(kind => {
			const model = valueKinds[kind];
			const resolve = model.dynamicStringResolver || ((value: string) => value);
			return {
				value: kind,
				label: resolve(model.label, player),
				submenu: model.submenu,
				tooltip: kindTooltip(resolve(model.shortDescription, player), model.fullDescription && resolve(model.fullDescription, player)),
			};
		});

export const actionKindOptions = (player: Player<any>, isPrepull: boolean): Array<KindOption<NonNullable<APLActionKind>>> =>
	(Object.keys(actionKinds) as Array<NonNullable<APLActionKind>>)
		.filter(kind => actionKinds[kind].includeIf?.(player, isPrepull) ?? true)
		.map(kind => {
			const model = actionKinds[kind];
			return { value: kind, label: model.label, submenu: model.submenu, tooltip: kindTooltip(model.shortDescription, model.fullDescription) };
		});
