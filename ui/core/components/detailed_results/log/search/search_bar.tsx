import clsx from 'clsx';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../../i18n/config';
import { TypedEvent } from '../../../../typed_event';
import { Component } from '../../../component';
import type { DropdownValueConfig } from '../../../pickers/dropdown_picker';
import { DropdownPicker, TextDropdownPicker } from '../../../pickers/dropdown_picker';
import type { SuggestionSource } from './indexes';
import { isNumericFilter } from './indexes';
import type { Clause, ClauseField, QueryNode } from './query';
import { FIELD_NAMES } from './query';

// Matches the debounce master's log search used.
const PENDING_DEBOUNCE_MS = 150;

const OUTCOME_SUGGESTIONS = ['hit', 'crit', 'miss', 'dodge', 'parry', 'glance', 'block', 'critical-block', 'blocked-glance'];
const TYPE_SUGGESTIONS = ['damage', 'heal', 'shield', 'resource', 'aura', 'buff', 'cast', 'major-cooldown', 'stat-change', 'debug'];

// These two are ranges and comparisons over a number, not a set of values, so they are typed
// rather than picked. The placeholders are syntax, so they are not translated.
const TYPED_FIELDS: Partial<Record<ClauseField, string>> = { time: '10-30', amount: '>5000' };

// Display only. Fields and values are matched case-insensitively, so capitalising the label
// cannot change what a query selects.
const sentenceCase = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

type ValueOption = DropdownValueConfig<string> & { label: string; iconUrl?: string };

// A field, the values picked under it, and how they join.
type SearchGroup = { field: ClauseField; join: 'and' | 'or'; values: Array<string> };

function clauseOf(field: ClauseField, value: string): QueryNode {
	return { kind: 'clause', clause: { field, values: [value], negated: false, raw: `${field}:${value}` } as Clause };
}

// A group only filters once it has something in it, so a field picked but not yet filled is
// invisible to the query rather than matching nothing.
function groupToNode(group: SearchGroup): QueryNode | null {
	if (!group.values.length) return null;
	if (group.values.length === 1) return clauseOf(group.field, group.values[0]);
	return { kind: group.join, children: group.values.map(value => clauseOf(group.field, value)) };
}

export class LogSearchBar extends Component {
	readonly changeEmitter = new TypedEvent<void>('Log Search');

	private groups: Array<SearchGroup> = [];
	private pendingTimer: number | null = null;
	private readonly inputElem: HTMLInputElement;
	private readonly groupsElem: HTMLDivElement;
	private readonly addFieldElem: HTMLDivElement;
	// Rebuilt with the groups, so the previous set has to be disposed rather than dropped.
	private pickers: Array<Component> = [];

	constructor(
		parent: HTMLElement,
		private readonly config: { suggestions: () => SuggestionSource },
	) {
		super(parent, 'log-search-bar');

		const groupsRef = ref<HTMLDivElement>();
		const inputRef = ref<HTMLInputElement>();
		const addFieldRef = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<>
				<input
					ref={inputRef}
					type="text"
					className="form-control log-search-input"
					placeholder={i18n.t('results_tab.details.logs.search_placeholder')}
					autocomplete="off"
				/>
				<div ref={groupsRef} className="log-search-groups">
					<div ref={addFieldRef} className="log-search-add-field"></div>
				</div>
			</>,
		);

		this.groupsElem = groupsRef.value!;
		this.inputElem = inputRef.value!;
		this.addFieldElem = addFieldRef.value!;

		// Plain substring search: anything structured is built with the filters below it.
		this.inputElem.addEventListener('input', () => {
			if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
			this.pendingTimer = window.setTimeout(() => {
				this.pendingTimer = null;
				this.emitChange();
			}, PENDING_DEBOUNCE_MS);
		});
		this.renderGroups();
	}

	get clauses(): ReadonlyArray<QueryNode> {
		const built = this.groups.map(groupToNode).filter((node): node is QueryNode => node !== null);
		const text = this.inputElem.value.trim();
		if (!text) return built;
		return [...built, { kind: 'clause', clause: { field: null, values: [text], negated: false, raw: text } as Clause }];
	}

	clear() {
		this.groups = [];
		this.inputElem.value = '';
		this.renderGroups();
		this.emitChange();
	}

	private renderGroups() {
		this.pickers.forEach(picker => picker.dispose());
		this.pickers = [];
		const stale: Array<ChildNode> = [];
		this.groupsElem.childNodes.forEach(node => {
			if (node !== this.addFieldElem) stale.push(node);
		});
		stale.forEach(node => this.groupsElem.removeChild(node));
		this.groups.forEach((group, i) => this.groupsElem.insertBefore(this.renderGroup(group, i), this.addFieldElem));
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
				values: FIELD_NAMES.map(field => ({ value: field, label: sentenceCase(field) })),
				getValue: () => null,
				setValue: (_eventID, _obj, field) => {
					if (!field) return;
					this.groups.push({ field, join: 'or', values: [] });
					this.renderGroups();
					this.emitChange();
				},
			}),
		);
	}

	private renderGroup(group: SearchGroup, index: number): HTMLElement {
		const itemsRef = ref<HTMLDivElement>();
		const addRef = ref<HTMLDivElement>();
		const removeRef = ref<HTMLButtonElement>();
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
									this.renderGroups();
									this.emitChange();
								}}>
								{join.toUpperCase()}
							</button>
						))}
					</div>
					<button ref={removeRef} type="button" className="log-search-group-remove saved-data-set-delete">
						<i className="fa fa-times fa-lg" />
					</button>
				</div>
				<div ref={itemsRef} className="log-search-group-items">
					<div ref={addRef} className="input-group"></div>
				</div>
			</div>
		) as HTMLElement;

		group.values.forEach((value, valueIndex) =>
			itemsRef.value!.insertBefore(
				this.renderTag(value, () => this.removeValue(index, valueIndex)),
				addRef.value!,
			),
		);
		removeRef.value!.addEventListener('click', () => this.removeGroup(index));
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
						<button ref={submitRef} type="button" className="log-search-group-submit btn btn-sm btn-primary" attributes={{ 'aria-label': 'Add' }}>
							<i className="fa fa-check" />
						</button>
					</>
				) as unknown as HTMLElement,
			);
			const commit = () => {
				const value = valueRef.value!.value.trim();
				// A value that cannot be parsed would match nothing, which reads as a broken filter
				// rather than a rejected one, so it is refused here instead.
				if (!value || !isNumericFilter(value) || group.values.includes(value)) return;
				group.values.push(value);
				this.renderGroups();
				this.emitChange();
			};
			valueRef.value!.addEventListener('keydown', e => {
				if (e.key === 'Enter') {
					e.preventDefault();
					commit();
				}
			});
			valueRef.value!.addEventListener('blur', commit);
			// mousedown, not click: the button's own click would blur the input first, and the
			// commit that blur triggers re-renders the group and takes the button away before the
			// click ever lands on it.
			submitRef.value!.addEventListener('mousedown', e => {
				e.preventDefault();
				commit();
			});
			return elem;
		}
		this.pickers.push(
			new DropdownPicker<LogSearchBar, string | null, string>(addRef.value!, this, {
				id: `log-search-group-${index}`,
				defaultLabel: i18n.t('results_tab.details.logs.search_add_value'),
				equals: (a, b) => a === b,
				values: this.valueOptions(group.field),
				setOptionContent: (button, valueConfig) => {
					const option = valueConfig as ValueOption;
					if (option.iconUrl) button.appendChild((<img className="log-search-option-icon" src={option.iconUrl} />) as HTMLElement);
					button.appendChild(document.createTextNode(option.label));
				},
				getValue: () => null,
				setValue: (_eventID, _obj, value) => {
					if (value && !group.values.includes(value)) group.values.push(value);
					this.renderGroups();
					this.emitChange();
				},
			}),
		);
		return elem;
	}

	private renderTag(label: string, onRemove: () => void): HTMLElement {
		const removeRef = ref<HTMLButtonElement>();
		const elem = (
			<div className="log-search-chip saved-data-set-chip badge rounded-pill">
				<span className="log-search-chip-text saved-data-set-name">{sentenceCase(label)}</span>
				<button ref={removeRef} type="button" className="log-search-chip-remove saved-data-set-delete">
					<i className="fa fa-times fa-lg" />
				</button>
			</div>
		) as HTMLElement;
		removeRef.value!.addEventListener('click', onRemove);
		return elem;
	}

	private removeGroup(index: number) {
		this.groups.splice(index, 1);
		this.renderGroups();
		this.emitChange();
	}

	private removeValue(groupIndex: number, valueIndex: number) {
		this.groups[groupIndex]?.values.splice(valueIndex, 1);
		this.renderGroups();
		this.emitChange();
	}

	private valueOptions(field: ClauseField): Array<ValueOption> {
		const icons = this.config.suggestions().spellIcons;
		return this.valueCandidates(field).map(value => ({ value, label: sentenceCase(value), iconUrl: icons.get(value) }));
	}

	private valueCandidates(field: ClauseField): Array<string> {
		switch (field) {
			case 'type':
				return TYPE_SUGGESTIONS;
			case 'outcome':
				return OUTCOME_SUGGESTIONS;
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
