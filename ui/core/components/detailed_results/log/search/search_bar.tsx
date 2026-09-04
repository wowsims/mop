import { ref } from 'tsx-vanilla';

import i18n from '../../../../../i18n/config';
import { TypedEvent } from '../../../../typed_event';
import { Component } from '../../../component';
import type { SuggestionSource } from './indexes';
import type { Clause, ClauseField } from './query';
import { clauseText, FIELD_NAMES, parseQuery, splitToken } from './query';

const OUTCOME_SUGGESTIONS = ['hit', 'crit', 'miss', 'dodge', 'parry', 'glance', 'block', 'critical-block', 'blocked-glance'];
const TYPE_SUGGESTIONS = ['damage', 'heal', 'shield', 'resource', 'aura', 'buff', 'cast', 'major-cooldown', 'stat-change', 'debug'];
const SUGGESTION_LIMIT = 20;

export class LogSearchBar extends Component {
	readonly changeEmitter = new TypedEvent<void>('Log Search');

	private chips: Array<Clause> = [];
	private readonly inputElem: HTMLInputElement;
	private readonly chipsElem: HTMLDivElement;
	private readonly suggestionsElem: HTMLUListElement;

	constructor(
		parent: HTMLElement,
		private readonly config: { suggestions: () => SuggestionSource },
	) {
		super(parent, 'log-search-bar');

		const chipsRef = ref<HTMLDivElement>();
		const inputRef = ref<HTMLInputElement>();
		const suggestionsRef = ref<HTMLUListElement>();

		this.rootElem.appendChild(
			<>
				<div ref={chipsRef} className="log-search-chips">
					<input
						ref={inputRef}
						type="text"
						className="form-control log-search-input"
						placeholder={i18n.t('results_tab.details.logs.search_placeholder')}
						autocomplete="off"
					/>
				</div>
				<ul ref={suggestionsRef} className="log-search-suggestions" hidden></ul>
			</>,
		);

		this.chipsElem = chipsRef.value!;
		this.inputElem = inputRef.value!;
		this.suggestionsElem = suggestionsRef.value!;

		this.inputElem.addEventListener('keydown', e => this.onKeyDown(e));
		this.inputElem.addEventListener('input', () => this.updateSuggestions());
		this.inputElem.addEventListener('focus', () => this.updateSuggestions());
		this.inputElem.addEventListener('blur', () => this.hideSuggestions());
	}

	get clauses(): ReadonlyArray<Clause> {
		return this.chips;
	}

	clear() {
		this.chips = [];
		this.inputElem.value = '';
		this.renderChips();
		this.hideSuggestions();
		this.emitChange();
	}

	private onKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			this.commit();
		} else if (e.key === ' ' && !this.isInsideQuotes()) {
			e.preventDefault();
			this.commit();
		} else if (e.key === 'Backspace' && this.inputElem.value === '' && this.chips.length > 0) {
			e.preventDefault();
			this.chips.pop();
			this.renderChips();
			this.updateSuggestions();
			this.emitChange();
		} else if (e.key === 'Escape') {
			this.hideSuggestions();
		}
	}

	private isInsideQuotes(): boolean {
		let quoteCount = 0;
		for (const ch of this.inputElem.value) if (ch === '"') quoteCount++;
		return quoteCount % 2 === 1;
	}

	private commit() {
		const text = this.inputElem.value.trim();
		if (!text) return;
		const clauses = parseQuery(text);
		if (!clauses.length) return;
		this.chips.push(...clauses);
		this.inputElem.value = '';
		this.renderChips();
		this.updateSuggestions();
		this.emitChange();
	}

	private editChip(index: number) {
		const [clause] = this.chips.splice(index, 1);
		this.inputElem.value = clauseText(clause);
		this.inputElem.focus();
		this.renderChips();
		this.updateSuggestions();
		this.emitChange();
	}

	private removeChip(index: number) {
		this.chips.splice(index, 1);
		this.renderChips();
		this.updateSuggestions();
		this.emitChange();
	}

	private renderChips() {
		const toRemove: Array<ChildNode> = [];
		this.chipsElem.childNodes.forEach(node => {
			if (node !== this.inputElem) toRemove.push(node);
		});
		toRemove.forEach(node => this.chipsElem.removeChild(node));
		this.chips.forEach((clause, i) => this.chipsElem.insertBefore(this.renderChip(clause, i), this.inputElem));
	}

	private renderChip(clause: Clause, index: number): HTMLSpanElement {
		const bodyRef = ref<HTMLSpanElement>();
		const removeRef = ref<HTMLButtonElement>();
		const elem = (
			<span className="log-search-chip">
				<span ref={bodyRef} className="log-search-chip-text">
					{clauseText(clause)}
				</span>
				<button ref={removeRef} type="button" className="log-search-chip-remove">
					×
				</button>
			</span>
		) as HTMLSpanElement;
		bodyRef.value!.addEventListener('click', () => this.editChip(index));
		removeRef.value!.addEventListener('click', () => this.removeChip(index));
		return elem;
	}

	private updateSuggestions() {
		const { text, field, valuePart } = splitToken(this.inputElem.value);

		if (valuePart === null) {
			const prefix = text.toLowerCase();
			this.renderSuggestions(
				FIELD_NAMES.filter(name => name.startsWith(prefix)),
				'field',
			);
			return;
		}

		if (!field) {
			this.renderSuggestions([], 'value');
			return;
		}
		const lastPipe = valuePart.lastIndexOf('|');
		const partial = (lastPipe === -1 ? valuePart : valuePart.slice(lastPipe + 1)).toLowerCase();
		const candidates = this.valueCandidates(field);
		this.renderSuggestions(
			candidates.filter(value => value.toLowerCase().includes(partial)),
			'value',
		);
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

	private renderSuggestions(items: Array<string>, mode: 'field' | 'value') {
		this.suggestionsElem.replaceChildren();
		const shown = items.slice(0, SUGGESTION_LIMIT);
		if (!shown.length) {
			this.suggestionsElem.hidden = true;
			return;
		}
		this.suggestionsElem.hidden = false;
		for (const item of shown) {
			const li = (<li className="log-search-suggestion">{item}</li>) as HTMLLIElement;
			// mousedown (not click) fires before the input's blur, so preventDefault here keeps
			// focus in the input instead of the suggestion click closing the list first.
			li.addEventListener('mousedown', e => {
				e.preventDefault();
				this.applySuggestion(mode, item);
			});
			this.suggestionsElem.appendChild(li);
		}
	}

	private applySuggestion(mode: 'field' | 'value', item: string) {
		const text = this.inputElem.value;
		const negatedPrefix = text.startsWith('-') ? '-' : '';
		if (mode === 'field') {
			this.inputElem.value = `${negatedPrefix}${item}:`;
		} else {
			const { fieldName, valuePart } = splitToken(text);
			const fieldPart = `${fieldName}:`;
			const lastPipe = (valuePart ?? '').lastIndexOf('|');
			const orPrefix = lastPipe === -1 ? '' : (valuePart ?? '').slice(0, lastPipe + 1);
			const value = /\s/.test(item) ? `"${item}"` : item;
			this.inputElem.value = `${negatedPrefix}${fieldPart}${orPrefix}${value}`;
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
