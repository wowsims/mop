import clsx from 'clsx';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../../i18n/config';
import type { Outcome } from '../../../../proto_utils/combat_log/types';
import { OUTCOMES } from '../../../../proto_utils/combat_log/types';
import { TypedEvent } from '../../../../typed_event';
import { Component } from '../../../component';
import type { DropdownValueConfig } from '../../../pickers/dropdown_picker';
import { DropdownPicker, TextDropdownPicker } from '../../../pickers/dropdown_picker';
import { OUTCOME_LABEL } from '../components/results';
import type { SuggestionSource } from './indexes';
import { isNumericFilter, TYPE_SUGGESTIONS } from './indexes';
import type { ClauseField, SearchGroup } from './query';
import { FIELD_NAMES } from './query';

// Matches the debounce master's log search used.
const PENDING_DEBOUNCE_MS = 150;

// The groups sit in the bottom bar's drawer, which clips its overflow; a fixed-position menu is
// the one that still opens past its edge, and dropup is the direction that has room down there.
const FIXED_POPPER = { strategy: 'fixed' };

// These two are ranges and comparisons over a number, not a set of values, so they are typed
// rather than picked. The placeholders are syntax, so they are not translated.
const TYPED_FIELDS: Partial<Record<ClauseField, string>> = { time: '10-30', amount: '>5000' };

// Display only. Fields and values are matched case-insensitively, so capitalising the label
// cannot change what a query selects.
export const sentenceCase = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

// Tokens take the words the log lines use, so a chip reads like the rows it selects.
export function labelOf(field: ClauseField, value: string): string {
	switch (field) {
		case 'outcome':
			return OUTCOME_LABEL[value as Outcome] ?? value;
		case 'type':
			return sentenceCase(value.replace(/-/g, ' '));
		default:
			return value;
	}
}

type ValueOption = DropdownValueConfig<string> & { label: string; iconUrl?: string };

// The chip's delete and the group's delete are the same control; .saved-data-set-delete carries
// the look, this carries the markup.
function DeleteButton(onClick: () => void): HTMLButtonElement {
	const elem = (
		<button type="button" className="saved-data-set-delete">
			<i className="fa fa-times fa-lg" />
		</button>
	) as HTMLButtonElement;
	elem.addEventListener('click', onClick);
	return elem;
}

// Quoted phrases stay whole, everything else splits on whitespace.
function keywordsOf(text: string): Array<string> {
	const keywords: Array<string> = [];
	for (const match of text.matchAll(/"([^"]+)"|\S+/g)) keywords.push(match[1] ?? match[0]);
	return keywords;
}

export class LogSearchBar extends Component {
	readonly changeEmitter = new TypedEvent<void>('Log Search');

	private searchGroups: Array<SearchGroup> = [];
	// Typed values not yet committed, kept across the re-render every other edit triggers.
	private readonly drafts = new WeakMap<SearchGroup, string>();
	private pendingTimer: number | null = null;
	private readonly inputElem: HTMLInputElement;
	private readonly groupsElem: HTMLDivElement;
	private readonly addFieldElem: HTMLDivElement;
	// Rebuilt with the groups, so the previous set has to be disposed rather than dropped.
	private pickers: Array<Component> = [];

	constructor(
		parent: HTMLElement,
		private readonly config: { suggestions: () => SuggestionSource },
		// The keyword box lives apart from the groups: it stays above the rows while the groups sit
		// in the bar under them, and a group is two rows tall once it has values anyway.
		inputParent: HTMLElement,
	) {
		super(parent, 'log-search-bar');

		const groupsRef = ref<HTMLDivElement>();
		const inputRef = ref<HTMLInputElement>();
		const addFieldRef = ref<HTMLDivElement>();

		inputParent.appendChild(
			<input
				ref={inputRef}
				type="text"
				className="form-control log-search-input"
				placeholder={i18n.t('results_tab.details.logs.search_placeholder')}
				autocomplete="off"
			/>,
		);
		// Add filter sits on its own row under the groups, so it does not drift sideways as they come and go.
		this.rootElem.appendChild(
			<>
				<div ref={groupsRef} className="log-search-groups d-flex flex-wrap align-items-start row-gap-1 column-gap-2"></div>
				<div ref={addFieldRef} className="log-search-add-field"></div>
			</>,
		);

		this.groupsElem = groupsRef.value!;
		this.inputElem = inputRef.value!;
		this.addFieldElem = addFieldRef.value!;

		// Keywords, all of which must match; anything structured is built with the filters below it.
		this.inputElem.addEventListener('input', () => {
			if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
			this.pendingTimer = window.setTimeout(() => {
				this.pendingTimer = null;
				this.emitChange();
			}, PENDING_DEBOUNCE_MS);
		});
		this.renderGroups();
	}

	get groups(): ReadonlyArray<SearchGroup> {
		return this.searchGroups;
	}

	get keywords(): ReadonlyArray<string> {
		return keywordsOf(this.inputElem.value);
	}

	clearGroups() {
		this.searchGroups = [];
		this.update();
	}

	// The value pickers snapshot their options, so a new result has to rebuild them.
	refresh() {
		this.renderGroups();
	}

	// Every edit does the same two things, so they are one call rather than a pair that a new
	// mutation site could half-forget.
	private update() {
		this.renderGroups();
		this.emitChange();
	}

	private renderGroups() {
		this.pickers.forEach(picker => picker.dispose());
		this.pickers = [];
		this.groupsElem.replaceChildren(...this.searchGroups.map((group, i) => this.renderGroup(group, i)));
		this.renderAddField();
	}

	// The same plain dropdown the APL uses to pick a field: no icons, and it falls back to its
	// label after a pick because choosing a property is the start of a group, not a setting.
	private renderAddField() {
		this.addFieldElem.replaceChildren();
		this.pickers.push(
			new TextDropdownPicker<LogSearchBar, ClauseField | null>(this.addFieldElem, this, {
				id: 'log-search-add-filter',
				defaultLabel: i18n.t('results_tab.details.logs.search_add_filter'),
				equals: (a, b) => a === b,
				popperConfig: FIXED_POPPER,
				extraCssClasses: ['dropup'],
				values: FIELD_NAMES.map(field => ({ value: field, label: sentenceCase(field) })),
				getValue: () => null,
				setValue: (_eventID, _obj, field) => {
					if (!field) return;
					this.searchGroups.push({ field, join: 'or', values: [] });
					this.update();
				},
			}),
		);
	}

	private renderGroup(group: SearchGroup, index: number): HTMLElement {
		const itemsRef = ref<HTMLDivElement>();
		const addRef = ref<HTMLDivElement>();
		const elem = (
			<div className="log-search-group">
				<div className="log-search-group-head">
					<span className="log-search-group-field">{sentenceCase(group.field)}</span>
					<div className="log-search-group-join btn-group btn-group-sm" attributes={{ role: 'group' }}>
						{(['and', 'or'] as const).map(join => (
							<button
								type="button"
								className={clsx('btn', 'btn-sm', group.join === join ? 'btn-primary' : 'btn-outline-primary')}
								attributes={{ 'aria-pressed': group.join === join }}
								onclick={() => {
									if (group.join === join) return;
									group.join = join;
									this.update();
								}}>
								{join.toUpperCase()}
							</button>
						))}
					</div>
					{DeleteButton(() => this.removeGroup(index))}
				</div>
				<div ref={itemsRef} className="log-search-group-items d-flex flex-wrap align-items-center gap-1">
					<div ref={addRef} className="input-group"></div>
				</div>
			</div>
		) as HTMLElement;

		group.values.forEach((value, valueIndex) =>
			itemsRef.value!.insertBefore(
				this.renderTag(labelOf(group.field, value), () => this.removeValue(index, valueIndex)),
				addRef.value!,
			),
		);
		const placeholder = TYPED_FIELDS[group.field];
		if (placeholder) {
			const valueRef = ref<HTMLInputElement>();
			const submitRef = ref<HTMLButtonElement>();
			addRef.value!.appendChild(
				(
					<>
						<input
							ref={valueRef}
							type="text"
							className="form-control form-control-sm log-search-group-input"
							placeholder={placeholder}
							autocomplete="off"
						/>
						<button
							ref={submitRef}
							type="button"
							className="btn btn-sm btn-primary"
							attributes={{ 'aria-label': i18n.t('results_tab.details.logs.search_add_value') }}>
							<i className="fa fa-check" />
						</button>
					</>
				) as unknown as HTMLElement,
			);
			valueRef.value!.value = this.drafts.get(group) ?? '';
			valueRef.value!.addEventListener('input', () => this.drafts.set(group, valueRef.value!.value));
			const commit = () => {
				const value = valueRef.value!.value.trim();
				// A value that cannot be parsed would match nothing, which reads as a broken filter
				// rather than a rejected one, so it is refused here instead.
				if (!value || !isNumericFilter(value) || group.values.includes(value)) return;
				this.drafts.delete(group);
				group.values.push(value);
				this.update();
			};
			valueRef.value!.addEventListener('keydown', e => {
				if (e.key === 'Enter') {
					e.preventDefault();
					commit();
				}
			});
			submitRef.value!.addEventListener('click', commit);
			return elem;
		}
		this.pickers.push(
			new DropdownPicker<LogSearchBar, string | null, string>(addRef.value!, this, {
				id: `log-search-group-${index}`,
				defaultLabel: i18n.t('results_tab.details.logs.search_add_value'),
				equals: (a, b) => a === b,
				popperConfig: FIXED_POPPER,
				extraCssClasses: ['dropup'],
				values: this.valueOptions(group.field),
				setOptionContent: (button, valueConfig) => {
					const option = valueConfig as ValueOption;
					if (option.iconUrl) button.appendChild((<img className="icon-sm me-1" src={option.iconUrl} />) as HTMLElement);
					button.appendChild(document.createTextNode(option.label));
				},
				getValue: () => null,
				setValue: (_eventID, _obj, value) => {
					if (value && !group.values.includes(value)) group.values.push(value);
					this.update();
				},
			}),
		);
		return elem;
	}

	private renderTag(label: string, onRemove: () => void): HTMLElement {
		return (
			<div className="log-search-chip saved-data-set-chip badge rounded-pill">
				<span className="saved-data-set-name">{label}</span>
				{DeleteButton(onRemove)}
			</div>
		) as HTMLElement;
	}

	private removeGroup(index: number) {
		this.searchGroups.splice(index, 1);
		this.update();
	}

	private removeValue(groupIndex: number, valueIndex: number) {
		this.searchGroups[groupIndex]?.values.splice(valueIndex, 1);
		this.update();
	}

	private valueOptions(field: ClauseField): Array<ValueOption> {
		const icons = this.config.suggestions().spellIcons;
		return this.valueCandidates(field).map(value => ({ value, label: labelOf(field, value), iconUrl: icons.get(value) }));
	}

	private valueCandidates(field: ClauseField): ReadonlyArray<string> {
		switch (field) {
			case 'type':
				return TYPE_SUGGESTIONS;
			case 'outcome':
				return OUTCOMES;
			case 'school':
				return this.config.suggestions().schools;
			case 'spell':
				return this.config.suggestions().spells;
			case 'source':
			case 'target':
				return this.config.suggestions().units;
			default:
				return [];
		}
	}

	private emitChange() {
		this.changeEmitter.emit(TypedEvent.nextEventID());
	}
}
