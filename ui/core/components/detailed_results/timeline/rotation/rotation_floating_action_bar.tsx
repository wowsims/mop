import { ref } from 'tsx-vanilla';

import i18n from '../../../../../i18n/config';
import { Component } from '../../../component';
import type { ContentRow, RotationModel, Section } from './model';
import type { VisibilityState } from './visibility';

function sectionTitle(section: Section): string {
	switch (section.kind) {
		case 'player':
			return 'Player';
		case 'buffs':
			return 'Buffs';
		case 'targetCasts':
			return `${section.label} - Casts`;
		case 'targetDebuffs':
			return `${section.label} - Debuffs`;
		default:
			return section.label;
	}
}

const Chip = ({ rowKey, label }: { rowKey: string; label: string }) =>
	(
		<button
			type="button"
			className="rotation-fab-chip saved-data-set-chip badge rounded-pill active"
			tabIndex={-1}
			dataset={{ rowKey }}
			attributes={{ role: 'switch', 'aria-checked': 'true' }}>
			<span className="saved-data-set-name">{label}</span>
		</button>
	) as HTMLButtonElement;

const Group = ({ title, chips }: { title: string; chips: Array<HTMLButtonElement> }) => {
	if (chips.length) chips[0].tabIndex = 0;
	return (
		<div className="rotation-fab-group">
			<div className="rotation-fab-group-title">{title}</div>
			<div className="rotation-fab-group-chips">{chips}</div>
		</div>
	) as HTMLDivElement;
};

export class RotationFloatingActionBar extends Component {
	private readonly visibility: VisibilityState;
	private readonly toggleButton: HTMLButtonElement;
	private readonly showAllButton: HTMLButtonElement;
	private readonly summaryElem: HTMLElement;
	private readonly previewElem: HTMLElement;
	private readonly panelInner: HTMLElement;
	private readonly groupsElem: HTMLDivElement;
	private readonly chips = new Map<string, HTMLButtonElement>();

	private model: RotationModel | null = null;
	private groupsBuilt = false;
	private expanded = false;

	constructor(parent: HTMLElement, visibility: VisibilityState) {
		super(parent, 'rotation-floating-action-bar-root');
		this.visibility = visibility;

		const toggleRef = ref<HTMLButtonElement>();
		const summaryRef = ref<HTMLSpanElement>();
		const previewRef = ref<HTMLSpanElement>();
		const showAllRef = ref<HTMLButtonElement>();
		const panelRef = ref<HTMLDivElement>();
		const groupsRef = ref<HTMLDivElement>();

		this.rootElem.dataset.expanded = 'false';
		this.rootElem.appendChild(
			<>
				<div className="rotation-fab-clip">
					<div ref={panelRef} className="rotation-fab-panel">
						<div className="rotation-fab-panel-inner">
							<div ref={groupsRef} className="rotation-fab-groups" />
						</div>
					</div>
				</div>
				<div className="rotation-fab-actions">
					<button
						ref={toggleRef}
						type="button"
						className="btn btn-primary rotation-fab-toggle"
						attributes={{ 'aria-expanded': 'false', 'aria-label': i18n.t('results_tab.details.timeline.floatingActionBar.toggle') }}>
						<i className="fas fa-eye-slash" />
						<span ref={summaryRef} className="rotation-fab-summary" />
						<span ref={previewRef} className="rotation-fab-preview" />
					</button>
					<button ref={showAllRef} type="button" className="btn btn-sm btn-link btn-reset ms-auto rotation-fab-show-all">
						<i className="fas fa-times me-1" />
						{i18n.t('results_tab.details.timeline.floatingActionBar.showAll')}
					</button>
				</div>
			</>,
		);

		this.toggleButton = toggleRef.value!;
		this.showAllButton = showAllRef.value!;
		this.summaryElem = summaryRef.value!;
		this.previewElem = previewRef.value!;
		this.groupsElem = groupsRef.value!;
		// The clip wrapper only hides the collapsed chips; inert is what takes them out of the tab order.
		this.panelInner = panelRef.value!.firstElementChild as HTMLElement;
		this.panelInner.inert = true;

		this.toggleButton.addEventListener('click', () => this.setExpanded(!this.expanded));
		this.showAllButton.addEventListener('click', () => this.visibility.showAll());
		this.groupsElem.addEventListener('click', event => this.onChipClick(event));
		this.rootElem.addEventListener('keydown', event => this.onKeyDown(event));

		// Bottom-sticky mirror of StickyToolbar: the bar only stops fitting whole against the
		// viewport's last pixel once it is actually pinned. The 0 threshold is load-bearing: the bar
		// is built inside the hidden Results tab, so its ratio goes 0 -> pinned without ever passing
		// through 1, and a [1]-only observer is never called again after that first hidden callback.
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

	setModel(model: RotationModel | null) {
		this.model = model;
		this.chips.clear();
		this.groupsElem.replaceChildren();
		this.groupsBuilt = false;
		if (this.expanded) this.ensureGroups();
		this.sync();
	}

	sync() {
		this.updateSummary();
		this.syncChips();
	}

	private setExpanded(expanded: boolean) {
		this.expanded = expanded;
		this.rootElem.dataset.expanded = String(expanded);
		this.toggleButton.setAttribute('aria-expanded', String(expanded));
		this.panelInner.inert = !expanded;
		if (expanded) this.ensureGroups();
	}

	private ensureGroups() {
		const model = this.model;
		if (this.groupsBuilt || !model) return;
		this.groupsBuilt = true;
		this.chips.clear();

		const groups = model.sections
			.map(section => ({
				section,
				rows: section.rowKeys.map(key => this.rowFor(key)).filter((row): row is ContentRow => row.kind !== 'header' && row.kind !== 'separator'),
			}))
			.filter(group => group.rows.length > 0)
			.map(({ section, rows }) =>
				Group({
					title: sectionTitle(section),
					chips: rows.map(row => {
						const chip = Chip({ rowKey: row.key, label: row.label });
						this.chips.set(row.key, chip);
						return chip;
					}),
				}),
			);
		this.groupsElem.replaceChildren(...groups);
		this.syncChips();
	}

	private rowFor(key: string) {
		const model = this.model!;
		return model.rows[model.byKey.get(key)!];
	}

	private syncChips() {
		this.chips.forEach((chip, key) => {
			const hidden = this.visibility.isHidden(key);
			chip.setAttribute('aria-checked', String(!hidden));
			chip.classList.toggle('active', !hidden);
		});
	}

	private updateSummary() {
		const model = this.model;
		const hiddenKeys = [...this.visibility.hidden].filter(key => !!model?.byKey.has(key));
		this.summaryElem.textContent = hiddenKeys.length
			? i18n.t('results_tab.details.timeline.floatingActionBar.hidden', { count: hiddenKeys.length })
			: i18n.t('results_tab.details.timeline.floatingActionBar.allShown');
		const labels = hiddenKeys.slice(0, 3).map(key => {
			const row = this.rowFor(key);
			return row.kind === 'separator' ? '' : row.label;
		});
		this.previewElem.textContent = labels.length ? `${labels.join(', ')}${hiddenKeys.length > labels.length ? ', …' : ''}` : '';
		this.showAllButton.hidden = hiddenKeys.length === 0;
	}

	private onChipClick(event: Event) {
		const chip = (event.target as Element).closest<HTMLButtonElement>('.rotation-fab-chip');
		const key = chip?.dataset.rowKey;
		if (key) this.visibility.set(key, !this.visibility.isHidden(key));
	}

	private onKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			this.setExpanded(false);
			this.toggleButton.focus();
			event.preventDefault();
			return;
		}
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		const chip = (event.target as Element).closest<HTMLButtonElement>('.rotation-fab-chip');
		const group = chip?.parentElement;
		if (!chip || !group) return;
		const chips = [...group.querySelectorAll<HTMLButtonElement>('.rotation-fab-chip')];
		const next = chips[(chips.indexOf(chip) + (event.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length];
		chip.tabIndex = -1;
		next.tabIndex = 0;
		next.focus();
		event.preventDefault();
	}
}
