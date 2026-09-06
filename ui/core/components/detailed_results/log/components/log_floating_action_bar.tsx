import { ref } from 'tsx-vanilla';

import i18n from '../../../../../i18n/config';
import { Component } from '../../../component';
import type { SuggestionSource } from '../search/indexes';
import { labelOf, LogSearchBar, sentenceCase } from '../search/search_bar';

// The log's counterpart of the timeline's row-visibility bar: a bottom-sticky strip that keeps
// the structured filters behind a toggle, plus whatever the log mounts in `actionsElem`. The
// keyword box is not in here; it stays above the rows, where master had it.
export class LogFloatingActionBar extends Component {
	readonly searchBar: LogSearchBar;
	readonly actionsElem: HTMLDivElement;
	private readonly toggleButton: HTMLButtonElement;
	private readonly clearButton: HTMLButtonElement;
	private readonly summaryElem: HTMLElement;
	private readonly previewElem: HTMLElement;
	private readonly panelInner: HTMLElement;
	private expanded = false;

	constructor(parent: HTMLElement, config: { suggestions: () => SuggestionSource }, inputParent: HTMLElement) {
		super(parent, 'log-floating-action-bar-root');

		const toggleRef = ref<HTMLButtonElement>();
		const summaryRef = ref<HTMLSpanElement>();
		const previewRef = ref<HTMLSpanElement>();
		const clearRef = ref<HTMLButtonElement>();
		const panelRef = ref<HTMLDivElement>();
		const filtersRef = ref<HTMLDivElement>();
		const actionsRef = ref<HTMLDivElement>();

		this.rootElem.dataset.expanded = 'false';
		this.rootElem.appendChild(
			<>
				<div className="log-fab-clip">
					<div ref={panelRef} className="log-fab-panel">
						<div className="log-fab-panel-inner">
							<div ref={filtersRef} className="log-fab-filters" />
						</div>
					</div>
				</div>
				<div className="log-fab-actions">
					<button
						ref={toggleRef}
						type="button"
						className="btn btn-primary log-fab-toggle"
						attributes={{ 'aria-expanded': 'false', 'aria-label': i18n.t('results_tab.details.logs.floatingActionBar.toggle') }}>
						<i className="fas fa-filter" />
						<span ref={summaryRef} className="log-fab-summary" />
						<span ref={previewRef} className="log-fab-preview" />
					</button>
					<button ref={clearRef} type="button" className="btn btn-sm btn-link btn-reset log-fab-clear">
						<i className="fas fa-times me-1" />
						{i18n.t('results_tab.details.logs.floatingActionBar.clear')}
					</button>
					<div ref={actionsRef} className="log-fab-controls" />
				</div>
			</>,
		);

		this.toggleButton = toggleRef.value!;
		this.clearButton = clearRef.value!;
		this.summaryElem = summaryRef.value!;
		this.previewElem = previewRef.value!;
		this.actionsElem = actionsRef.value!;
		// The clip wrapper only hides the collapsed panel; inert is what takes it out of the tab order.
		this.panelInner = panelRef.value!.firstElementChild as HTMLElement;
		this.panelInner.inert = true;

		this.searchBar = this.addChild(new LogSearchBar(filtersRef.value!, config, inputParent));
		this.searchBar.changeEmitter.on(() => this.sync());

		this.toggleButton.addEventListener('click', () => this.setExpanded(!this.expanded));
		this.clearButton.addEventListener('click', () => this.searchBar.clearGroups());
		this.rootElem.addEventListener('keydown', event => {
			if (event.key !== 'Escape' || !this.expanded) return;
			this.setExpanded(false);
			this.toggleButton.focus();
			event.preventDefault();
		});

		// Same observer as the rotation's bar, for the same reason: built inside the hidden Results
		// tab, the ratio goes 0 -> pinned without passing through 1, so [1] alone never fires again.
		const observer = new IntersectionObserver(
			([entry]) => this.rootElem.classList.toggle('stuck', entry.target.clientHeight > 0 && entry.intersectionRatio < 1),
			{
				rootMargin: '0px 0px -1px 0px',
				threshold: [0, 1],
			},
		);
		observer.observe(this.rootElem);
		this.addOnDisposeCallback(() => observer.disconnect());

		this.sync();
	}

	private setExpanded(expanded: boolean) {
		this.expanded = expanded;
		this.rootElem.dataset.expanded = String(expanded);
		this.toggleButton.setAttribute('aria-expanded', String(expanded));
		this.panelInner.inert = !expanded;
	}

	private sync() {
		const labels = this.searchBar.groups
			.filter(group => group.values.length > 0)
			.map(group => `${sentenceCase(group.field)}: ${group.values.map(value => labelOf(group.field, value)).join(', ')}`);

		this.summaryElem.textContent = labels.length
			? i18n.t('results_tab.details.logs.floatingActionBar.active', { count: labels.length })
			: i18n.t('results_tab.details.logs.floatingActionBar.none');
		this.previewElem.textContent = labels.length ? `${labels.slice(0, 3).join(', ')}${labels.length > 3 ? ', …' : ''}` : '';
		this.clearButton.hidden = labels.length === 0;
	}
}
