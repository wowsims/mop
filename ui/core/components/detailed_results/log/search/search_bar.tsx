import clsx from 'clsx';
import { ref } from 'tsx-vanilla';

import i18n from '../../../../../i18n/config';
import { TypedEvent } from '../../../../typed_event';
import { Component } from '../../../component';
import type { DropdownValueConfig } from '../../../pickers/dropdown_picker';
import { DropdownPicker, TextDropdownPicker } from '../../../pickers/dropdown_picker';
import type { SuggestionSource } from './indexes';
import type { Clause, ClauseField, QueryNode } from './query';
import { FIELD_NAMES, nodeText, parseChips, splitToken } from './query';

// Matches the debounce master's log search used.
const PENDING_DEBOUNCE_MS = 150;

// Typing one of these means the query is not finished, so space cannot end the chip here.
const OPERATOR_WORDS = new Set(['and', 'or', 'not']);

const OUTCOME_SUGGESTIONS = ['hit', 'crit', 'miss', 'dodge', 'parry', 'glance', 'block', 'critical-block', 'blocked-glance'];
const TYPE_SUGGESTIONS = ['damage', 'heal', 'shield', 'resource', 'aura', 'buff', 'cast', 'major-cooldown', 'stat-change', 'debug'];
const SUGGESTION_LIMIT = 20;

// Display only. Fields and enum values are matched case-insensitively, so capitalising the label
// cannot change what a query selects.
const sentenceCase = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

// What the picker shows one of. A field group is the built form - a field, its values, and how
// they join - and is what the UI edits. A raw group is anything typed that does not reduce to
// that shape (a bare word, a NOT, a mixed expression); it is kept whole and shown as one tag.
type SearchGroup = { kind: 'field'; field: ClauseField; join: 'and' | 'or'; negated: boolean; values: Array<string> } | { kind: 'raw'; node: QueryNode };

type ValueOption = DropdownValueConfig<string> & { label: string; iconUrl?: string };

// What a click on the suggestion list should do.
type Menu = { kind: 'input'; mode: 'field' | 'value' } | { kind: 'newField' } | { kind: 'groupValue'; index: number };

function clauseOf(field: ClauseField, value: string, negated: boolean): QueryNode {
	return { kind: 'clause', clause: { field, values: [value], negated, raw: `${field}:${value}` } as Clause };
}

// A group only filters once it has something in it, so a field picked but not yet filled is
// invisible to the query rather than matching nothing.
function groupToNode(group: SearchGroup): QueryNode | null {
	if (group.kind === 'raw') return group.node;
	if (!group.values.length) return null;
	if (group.values.length === 1) return clauseOf(group.field, group.values[0], group.negated);
	return { kind: group.join, children: group.values.map(value => clauseOf(group.field, value, group.negated)) };
}

// Typed text still has to land in the same model, so an expression is reduced to a field group
// when it is one, and kept whole when it is not.
function nodeToGroups(node: QueryNode): Array<SearchGroup> {
	if (node.kind === 'clause' && node.clause.field) {
		return [{ kind: 'field', field: node.clause.field, join: 'or', negated: node.clause.negated, values: [...node.clause.values] }];
	}
	if (node.kind === 'and' || node.kind === 'or') {
		const clauses = node.children.filter(child => child.kind === 'clause').map(child => (child as { clause: Clause }).clause);
		const first = clauses[0];
		const uniform = clauses.length === node.children.length && first?.field && clauses.every(c => c.field === first.field && c.negated === first.negated);
		if (uniform) {
			return [{ kind: 'field', field: first.field!, join: node.kind, negated: first.negated, values: clauses.flatMap(c => c.values) }];
		}
	}
	return [{ kind: 'raw', node }];
}

export class LogSearchBar extends Component {
	readonly changeEmitter = new TypedEvent<void>('Log Search');

	private groups: Array<SearchGroup> = [];
	private menu: Menu = { kind: 'input', mode: 'field' };
	private pendingTimer: number | null = null;
	private readonly inputElem: HTMLInputElement;
	private readonly chipsElem: HTMLDivElement;
	private readonly suggestionsElem: HTMLUListElement;
	private readonly addFieldElem: HTMLDivElement;
	// Rebuilt with the groups, so the previous set has to be disposed rather than dropped.
	private pickers: Array<Component> = [];

	constructor(
		parent: HTMLElement,
		private readonly config: { suggestions: () => SuggestionSource },
	) {
		super(parent, 'log-search-bar');

		const chipsRef = ref<HTMLDivElement>();
		const inputRef = ref<HTMLInputElement>();
		const suggestionsRef = ref<HTMLUListElement>();
		const addFieldRef = ref<HTMLDivElement>();

		this.rootElem.appendChild(
			<>
				<div className="log-search-field">
					<input
						ref={inputRef}
						type="text"
						className="form-control log-search-input"
						placeholder={i18n.t('results_tab.details.logs.search_placeholder')}
						autocomplete="off"
					/>
					<ul ref={suggestionsRef} className="log-search-suggestions dropdown-menu" hidden></ul>
				</div>
				<div ref={chipsRef} className="log-search-groups">
					<div ref={addFieldRef} className="log-search-add-field"></div>
				</div>
			</>,
		);

		this.chipsElem = chipsRef.value!;
		this.inputElem = inputRef.value!;
		this.suggestionsElem = suggestionsRef.value!;
		this.addFieldElem = addFieldRef.value!;

		this.inputElem.addEventListener('keydown', e => this.onKeyDown(e));
		this.inputElem.addEventListener('input', () => {
			this.updateSuggestions();
			// Uncommitted text filters too, on the same debounce master used. Without this a term
			// only takes effect on Enter, and a user who types and stops sees an unfiltered list
			// with nothing telling them why.
			if (this.pendingTimer !== null) clearTimeout(this.pendingTimer);
			this.pendingTimer = window.setTimeout(() => {
				this.pendingTimer = null;
				this.emitChange();
			}, PENDING_DEBOUNCE_MS);
		});
		this.inputElem.addEventListener('focus', () => this.updateSuggestions());
		this.inputElem.addEventListener('blur', () => this.hideSuggestions());
		this.renderGroups();
	}

	// The committed groups plus whatever is still being typed, so the two behave identically.
	get clauses(): ReadonlyArray<QueryNode> {
		const built = this.groups.map(groupToNode).filter((node): node is QueryNode => node !== null);
		const pending = this.inputElem.value.trim();
		return pending ? [...built, ...parseChips(pending)] : built;
	}

	clear() {
		this.groups = [];
		this.inputElem.value = '';
		this.renderGroups();
		this.hideSuggestions();
		this.emitChange();
	}

	private onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			this.commit();
		} else if (e.key === ' ' && this.spaceCommits()) {
			e.preventDefault();
			this.commit();
		} else if (e.key === 'Backspace' && this.inputElem.value === '' && this.groups.length > 0) {
			e.preventDefault();
			this.groups.pop();
			this.renderGroups();
			this.updateSuggestions();
			this.emitChange();
		} else if (e.key === 'Escape') {
			this.hideSuggestions();
		}
	}

	// Space is a convenient way to finish a plain term, but it must not chop an expression apart
	// mid-way: `source:Ghoul AND (Claw OR Sweeping)` is one query, and committing at every space
	// turns it into seven chips. Enter always commits, whatever the state.
	private spaceCommits(): boolean {
		if (this.isInsideQuotes()) return false;
		const text = this.inputElem.value;
		let depth = 0;
		let inQuotes = false;
		for (const ch of text) {
			if (ch === '"') inQuotes = !inQuotes;
			else if (!inQuotes && ch === '(') depth++;
			else if (!inQuotes && ch === ')') depth--;
		}
		if (depth > 0) return false;
		const lastToken = text.trimEnd().split(/\s+/).pop() ?? '';
		return !OPERATOR_WORDS.has(lastToken.toLowerCase());
	}

	private isInsideQuotes(): boolean {
		let quoteCount = 0;
		for (const ch of this.inputElem.value) if (ch === '"') quoteCount++;
		return quoteCount % 2 === 1;
	}

	private commit() {
		const text = this.inputElem.value.trim();
		if (!text) return;
		// A group is committed as soon as a space follows it, so by the time someone types the AND
		// or OR that was meant to join it to the next term, the left side is already committed.
		// Leading with an operator folds back into it rather than starting a broken expression.
		const first = text.split(/\s+/)[0].toLowerCase();
		const last = this.groups[this.groups.length - 1];
		const joined = (first === 'and' || first === 'or') && !!last;
		const source = joined
			? `${nodeText(groupToNode(last) ?? { kind: 'clause', clause: { field: null, values: [''], negated: false, raw: '' } })} ${text}`
			: text;
		const nodes = parseChips(source);
		if (!nodes.length) return;
		if (joined) this.groups.pop();
		this.groups.push(...nodes.flatMap(nodeToGroups));
		this.inputElem.value = '';
		this.renderGroups();
		this.updateSuggestions();
		this.emitChange();
	}

	private renderGroups() {
		this.pickers.forEach(picker => picker.dispose());
		this.pickers = [];
		const stale: Array<ChildNode> = [];
		this.chipsElem.childNodes.forEach(node => {
			if (node !== this.addFieldElem) stale.push(node);
		});
		stale.forEach(node => this.chipsElem.removeChild(node));
		this.groups.forEach((group, i) => this.chipsElem.insertBefore(this.renderGroup(group, i), this.addFieldElem));
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
					this.groups.push({ kind: 'field', field, join: 'or', negated: false, values: [] });
					this.renderGroups();
					this.emitChange();
				},
			}),
		);
	}

	private renderGroup(group: SearchGroup, index: number): HTMLElement {
		if (group.kind === 'raw') return this.renderTag(nodeText(group.node), () => this.removeGroup(index));

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
									if (group.kind !== 'field' || group.join === join) return;
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
					<div ref={addRef} className="log-search-group-add"></div>
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
					if (value && group.kind === 'field' && !group.values.includes(value)) group.values.push(value);
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
		this.hideSuggestions();
		this.emitChange();
	}

	private removeValue(groupIndex: number, valueIndex: number) {
		const group = this.groups[groupIndex];
		if (group.kind !== 'field') return;
		group.values.splice(valueIndex, 1);
		this.renderGroups();
		this.hideSuggestions();
		this.emitChange();
	}

	private updateSuggestions() {
		if (document.activeElement !== this.inputElem) {
			this.hideSuggestions();
			return;
		}
		const { text, field, valuePart } = splitToken(this.inputElem.value);

		if (valuePart === null) {
			this.menu = { kind: 'input', mode: 'field' };
			const prefix = text.toLowerCase();
			this.renderSuggestions(FIELD_NAMES.filter(name => name.startsWith(prefix)));
			return;
		}

		this.menu = { kind: 'input', mode: 'value' };
		if (!field) {
			this.renderSuggestions([]);
			return;
		}
		const lastPipe = valuePart.lastIndexOf('|');
		const partial = (lastPipe === -1 ? valuePart : valuePart.slice(lastPipe + 1)).toLowerCase();
		this.renderSuggestions(this.valueCandidates(field).filter(value => value.toLowerCase().includes(partial)));
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

	private renderSuggestions(items: Array<string>) {
		this.suggestionsElem.replaceChildren();
		const shown = items.slice(0, SUGGESTION_LIMIT);
		if (!shown.length) {
			this.suggestionsElem.hidden = true;
			return;
		}
		this.suggestionsElem.hidden = false;
		for (const item of shown) {
			const li = (
				<li>
					<button type="button" className="dropdown-item log-search-suggestion">
						{sentenceCase(item)}
					</button>
				</li>
			) as HTMLLIElement;
			// mousedown (not click) fires before the input's blur, so preventDefault here keeps
			// focus in the input instead of the suggestion click closing the list first.
			li.addEventListener('mousedown', e => {
				e.preventDefault();
				this.applySuggestion(item);
			});
			this.suggestionsElem.appendChild(li);
		}
	}

	private applySuggestion(item: string) {
		const menu = this.menu;
		if (menu.kind === 'newField') {
			const field = item as ClauseField;
			this.groups.push({ kind: 'field', field, join: 'or', negated: false, values: [] });
			this.renderGroups();
			// Straight on to picking a value: an empty group is a step, not a destination.
			this.menu = { kind: 'groupValue', index: this.groups.length - 1 };
			this.renderSuggestions(this.valueCandidates(field));
			return;
		}
		if (menu.kind === 'groupValue') {
			const group = this.groups[menu.index];
			if (group?.kind === 'field' && !group.values.includes(item)) group.values.push(item);
			this.renderGroups();
			this.hideSuggestions();
			this.emitChange();
			return;
		}

		const text = this.inputElem.value;
		const { negated, fieldName, valuePart } = splitToken(text);
		const negatedPrefix = negated ? '-' : '';
		if (menu.mode === 'field') {
			this.inputElem.value = `${negatedPrefix}${item}:`;
		} else {
			const lastPipe = (valuePart ?? '').lastIndexOf('|');
			const orPrefix = lastPipe === -1 ? '' : (valuePart ?? '').slice(0, lastPipe + 1);
			const value = /\s/.test(item) ? `"${item}"` : item;
			this.inputElem.value = `${negatedPrefix}${fieldName}:${orPrefix}${value}`;
		}
		this.inputElem.focus();
		this.updateSuggestions();
	}

	private hideSuggestions() {
		this.suggestionsElem.hidden = true;
	}

	private emitChange() {
		this.changeEmitter.emit(TypedEvent.nextEventID());
	}
}
