import type { Instance } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import type SecondaryResource from '../../../../proto_utils/secondary_resource';
import { Component } from '../../../component';
import { delegateTooltips } from '../tooltips';
import { createItemRenderer } from './components/rotation_items';
import { RotationRowElem, RowLabelCell, SectionHeaderRow, SeparatorRowElem } from './components/rotation_row';
import { RotationToolbar } from './components/rotation_toolbar';
import { VisibilityBar, VisibilityChip, VisibilityGroup } from './components/visibility_bar';
import type { ContentRow, HeaderRow, RotationModel, Row, Section } from './model';
import { computeOrder } from './model';
import { RowTrack } from './row_track';
import { Ruler } from './ruler';
import type { WindowHost } from './timeline_window';
import { TimelineWindow } from './timeline_window';
import { VisibilityState } from './visibility';
import { ZoomController } from './zoom';

export interface RotationViewConfig {
	secondaryResource?: SecondaryResource | null;
}

interface MountedRow {
	track: RowTrack;
	delegate: Instance;
}

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

export class RotationView extends Component implements WindowHost {
	readonly secondaryResource: SecondaryResource | null;

	private readonly scroller: HTMLDivElement;
	private readonly corner: HTMLDivElement;
	private readonly ruler: Ruler;
	private readonly zoom: ZoomController;
	private readonly rowWindow: TimelineWindow;
	private readonly visibility = new VisibilityState();

	private readonly visibilityRoot: HTMLDivElement;
	private readonly toggleButton: HTMLButtonElement;
	private readonly showAllButton: HTMLButtonElement;
	private readonly panelInner: HTMLElement;
	private readonly summaryElem: HTMLElement;
	private readonly previewElem: HTMLElement;
	private readonly groupsElem: HTMLDivElement;

	private readonly mountedRows = new Map<string, MountedRow>();
	private readonly chips = new Map<string, HTMLButtonElement>();

	private model: RotationModel | null = null;
	private frame: number | null = null;
	private groupsBuilt = false;
	private expanded = false;
	private paneWidth = 0;

	constructor(parent: HTMLElement, config: RotationViewConfig) {
		super(parent, 'rotation-pane');
		this.secondaryResource = config.secondaryResource ?? null;

		const zoomOutRef = ref<HTMLButtonElement>();
		const zoomInRef = ref<HTMLButtonElement>();
		const fitRef = ref<HTMLButtonElement>();
		const resetRef = ref<HTMLButtonElement>();
		const canvasRef = ref<HTMLCanvasElement>();
		const scrollerRef = ref<HTMLDivElement>();
		const contentRef = ref<HTMLDivElement>();
		const topSpacerRef = ref<HTMLDivElement>();
		const bottomSpacerRef = ref<HTMLDivElement>();
		const toggleRef = ref<HTMLButtonElement>();
		const summaryRef = ref<HTMLSpanElement>();
		const previewRef = ref<HTMLSpanElement>();
		const showAllRef = ref<HTMLButtonElement>();
		const panelRef = ref<HTMLDivElement>();
		const groupsRef = ref<HTMLDivElement>();

		const toolbar = RotationToolbar({ zoomOutRef, zoomInRef, fitRef, resetRef });
		const visibilityBar = VisibilityBar({ toggleRef, summaryRef, previewRef, showAllRef, panelRef, groupsRef });

		this.rootElem.appendChild(
			<>
				<div className="rotation-header">
					{toolbar}
					<canvas ref={canvasRef} className="rotation-ruler" />
				</div>
				<div ref={scrollerRef} className="rotation-scroller" tabIndex={0}>
					<div ref={contentRef} className="rotation-content">
						<div ref={topSpacerRef} className="rotation-vspacer" />
						<div ref={bottomSpacerRef} className="rotation-vspacer" />
					</div>
				</div>
				{visibilityBar}
			</>,
		);

		this.corner = toolbar;
		this.scroller = scrollerRef.value!;
		this.visibilityRoot = visibilityBar;
		this.toggleButton = toggleRef.value!;
		this.showAllButton = showAllRef.value!;
		this.summaryElem = summaryRef.value!;
		this.previewElem = previewRef.value!;
		this.groupsElem = groupsRef.value!;
		// overflow: hidden hides the collapsed chips but leaves them in the tab order.
		this.panelInner = panelRef.value!.firstElementChild as HTMLElement;
		this.panelInner.inert = true;

		this.ruler = new Ruler(canvasRef.value!);
		this.zoom = new ZoomController({
			scroller: this.scroller,
			labelWidth: () => this.corner.offsetWidth,
			onChange: () => this.schedule(),
		});
		this.zoom.attach();
		this.rowWindow = new TimelineWindow(this.scroller, contentRef.value!, topSpacerRef.value!, bottomSpacerRef.value!, this);

		const onScroll = () => this.schedule();
		this.scroller.addEventListener('scroll', onScroll, { passive: true });

		const resizeObserver = new ResizeObserver(() => this.onResize());
		resizeObserver.observe(this.rootElem);

		zoomOutRef.value!.addEventListener('click', () => this.zoom.stepOut());
		zoomInRef.value!.addEventListener('click', () => this.zoom.stepIn());
		fitRef.value!.addEventListener('click', () => this.zoom.fitToWidth());
		resetRef.value!.addEventListener('click', () => this.zoom.reset());

		this.toggleButton.addEventListener('click', () => this.setExpanded(!this.expanded));
		this.showAllButton.addEventListener('click', () => this.visibility.showAll());
		this.groupsElem.addEventListener('click', event => this.onChipClick(event));
		this.visibilityRoot.addEventListener('keydown', event => this.onPanelKeyDown(event));

		this.addOnDisposeCallback(this.visibility.subscribe(() => this.onVisibilityChanged()));
		this.addOnDisposeCallback(() => {
			if (this.frame != null) cancelAnimationFrame(this.frame);
			this.scroller.removeEventListener('scroll', onScroll);
			resizeObserver.disconnect();
			this.zoom.dispose();
			this.rowWindow.unmountAll();
		});

		this.updateSummary();
	}

	setModel(model: RotationModel | null) {
		this.model = model;
		this.rowWindow.unmountAll();
		this.chips.clear();
		this.groupsElem.replaceChildren();
		this.groupsBuilt = false;

		if (!model) {
			this.rowWindow.invalidate([], () => 0);
			this.updateSummary();
			this.schedule();
			return;
		}

		this.scroller.style.setProperty('--duration', String(model.duration));
		this.zoom.setDuration(model.duration);
		this.measureLabelWidth();
		this.ruler.measure();
		this.rebuildOrder();
		if (this.expanded) this.ensureGroups();
		this.schedule();
	}

	acquireRow(key: string): HTMLElement {
		const row = this.rowFor(key);
		if (row.kind === 'separator') return SeparatorRowElem({ row });
		if (row.kind === 'header') return this.buildHeaderRow(row);
		return this.buildContentRow(row);
	}

	releaseRow(key: string, elem: HTMLElement) {
		const mounted = this.mountedRows.get(key);
		if (mounted) {
			this.mountedRows.delete(key);
			mounted.track.clear();
			mounted.delegate.destroy();
		}
		elem.remove();
	}

	windowRow(key: string, left: number, right: number, pps: number) {
		this.mountedRows.get(key)?.track.setWindow(left, right, pps);
	}

	private buildHeaderRow(row: HeaderRow): HTMLElement {
		const iconRef = ref<HTMLAnchorElement>();
		const elem = SectionHeaderRow({ row, iconRef });
		const icon = iconRef.value;
		if (row.actionId && icon) {
			row.actionId.fill().then(filled => {
				if (icon.isConnected) filled.setBackgroundAndHref(icon);
			});
		}
		return elem;
	}

	private buildContentRow(row: ContentRow): HTMLElement {
		const trackRef = ref<HTMLDivElement>();
		const iconRef = ref<HTMLAnchorElement>();
		const hideRef = ref<HTMLButtonElement>();
		const elem = RotationRowElem({ row, trackRef, iconRef, hideRef });

		const icon = iconRef.value!;
		if (row.kind === 'resource') {
			icon.style.backgroundImage = `url('${row.icon}')`;
		} else {
			row.actionId.setBackgroundAndHref(icon);
			row.actionId.setWowheadDataset(icon, { useBuffAura: row.kind === 'aura' });
		}

		hideRef.value!.addEventListener('click', () => this.visibility.set(row.key, true));

		const track = trackRef.value!;
		this.mountedRows.set(row.key, {
			track: new RowTrack(row, track, createItemRenderer(row)),
			// On the track, not the row, so hovering the sticky label never opens an item tooltip.
			delegate: delegateTooltips(track),
		});
		return elem;
	}

	private rowFor(key: string): Row {
		const model = this.model!;
		return model.rows[model.byKey.get(key)!];
	}

	private rebuildOrder() {
		const model = this.model;
		if (!model) return;
		this.rowWindow.invalidate(computeOrder(model, this.visibility.hidden), key => this.rowFor(key).height);
		this.updateSummary();
	}

	private onVisibilityChanged() {
		this.rebuildOrder();
		this.syncChips();
		this.schedule();
	}

	private measureLabelWidth() {
		const model = this.model;
		if (!model) return;
		let longest = '';
		for (const row of model.rows) {
			if (row.kind !== 'separator' && row.label.length > longest.length) longest = row.label;
		}
		// Inside the pane, so the lg breakpoint that hides .rotation-label-text applies here too.
		const measurer = (<div className="rotation-measurer">{RowLabelCell({ text: longest, withIcon: true, withHide: true })}</div>) as HTMLDivElement;
		this.rootElem.appendChild(measurer);
		const width = (measurer.firstElementChild as HTMLElement).offsetWidth;
		measurer.remove();
		this.rootElem.style.setProperty('--label-w', `clamp(8rem, ${Math.ceil(width)}px, 20rem)`);
	}

	private onResize() {
		const width = this.rootElem.clientWidth;
		if (width !== this.paneWidth) {
			this.paneWidth = width;
			this.measureLabelWidth();
			this.ruler.measure();
		}
		this.schedule();
	}

	private schedule() {
		if (this.frame != null) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = null;
			this.runFrame();
		});
	}

	private runFrame() {
		if (this.isDisposed) return;
		const pps = this.zoom.pps;
		this.rowWindow.update(pps, this.corner.offsetWidth);
		this.ruler.draw({ scrollLeft: this.scroller.scrollLeft, pps, duration: this.model?.duration ?? 0 });
	}

	private setExpanded(expanded: boolean) {
		this.expanded = expanded;
		this.visibilityRoot.dataset.expanded = String(expanded);
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
			.map(section => ({ section, rows: section.rowKeys.map(key => this.rowFor(key)).filter((row): row is ContentRow => row.hideable) }))
			.filter(group => group.rows.length > 0)
			.map(({ section, rows }) =>
				VisibilityGroup({
					title: sectionTitle(section),
					chips: rows.map(row => {
						const chip = VisibilityChip({ rowKey: row.key, label: row.label });
						this.chips.set(row.key, chip);
						return chip;
					}),
				}),
			);
		this.groupsElem.replaceChildren(...groups);
		this.syncChips();
	}

	private syncChips() {
		this.chips.forEach((chip, key) => {
			const hidden = this.visibility.isHidden(key);
			chip.setAttribute('aria-checked', String(!hidden));
			chip.classList.toggle('is-hidden', hidden);
		});
	}

	private updateSummary() {
		const model = this.model;
		const hiddenKeys = [...this.visibility.hidden].filter(key => !!model?.byKey.has(key));
		this.summaryElem.textContent = hiddenKeys.length ? `${hiddenKeys.length} hidden` : 'All rows shown';
		const labels = hiddenKeys.slice(0, 3).map(key => {
			const row = this.rowFor(key);
			return row.kind === 'separator' ? '' : row.label;
		});
		this.previewElem.textContent = labels.length ? `${labels.join(', ')}${hiddenKeys.length > labels.length ? ', …' : ''}` : '';
		this.showAllButton.hidden = hiddenKeys.length === 0;
	}

	private onChipClick(event: Event) {
		const chip = (event.target as Element).closest<HTMLButtonElement>('.rotation-chip');
		const key = chip?.dataset.rowKey;
		if (key) this.visibility.set(key, !this.visibility.isHidden(key));
	}

	private onPanelKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			this.setExpanded(false);
			this.toggleButton.focus();
			event.preventDefault();
			return;
		}
		if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
		const chip = (event.target as Element).closest<HTMLButtonElement>('.rotation-chip');
		const group = chip?.parentElement;
		if (!chip || !group) return;
		const chips = [...group.querySelectorAll<HTMLButtonElement>('.rotation-chip')];
		const next = chips[(chips.indexOf(chip) + (event.key === 'ArrowRight' ? 1 : chips.length - 1)) % chips.length];
		chip.tabIndex = -1;
		next.tabIndex = 0;
		next.focus();
		event.preventDefault();
	}
}
