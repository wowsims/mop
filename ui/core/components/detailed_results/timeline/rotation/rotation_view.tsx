import type { Instance } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import type SecondaryResource from '../../../../proto_utils/secondary_resource';
import { Component } from '../../../component';
import { delegateTooltips } from '../tooltips';
import { createItemRenderer } from './components/rotation_items';
import { RotationRowElem, RowLabelCell, SectionHeaderRow, SeparatorRowElem } from './components/rotation_row';
import { RotationToolbar } from './components/rotation_toolbar';
import type { ContentRow, HeaderRow, RotationModel, Row } from './model';
import { computeOrder } from './model';
import { RotationFloatingActionBar } from './rotation_floating_action_bar';
import { RowTrack } from './row_track';
import { Ruler } from './ruler';
import type { WindowHost } from './timeline_window';
import { findScrollParent, TimelineWindow } from './timeline_window';
import { VisibilityState } from './visibility';
import { ZoomController } from './zoom';

export interface RotationViewConfig {
	secondaryResource?: SecondaryResource | null;
}

interface MountedRow {
	track: RowTrack;
	delegate: Instance;
}

export class RotationView extends Component implements WindowHost {
	readonly secondaryResource: SecondaryResource | null;

	private readonly scroller: HTMLDivElement;
	private readonly corner: HTMLDivElement;
	private readonly ruler: Ruler;
	private readonly zoom: ZoomController;
	private readonly rowWindow: TimelineWindow;
	private readonly visibility = new VisibilityState();
	private readonly actionBar: RotationFloatingActionBar;

	private readonly mountedRows = new Map<string, MountedRow>();
	private readonly resizeObserver = new ResizeObserver(() => this.onResize());
	private readonly onScroll = () => this.schedule();

	private model: RotationModel | null = null;
	private frame: number | null = null;
	private paneWidth = 0;
	private attached = false;
	private outer: HTMLElement | null = null;
	private outerTarget: EventTarget | null = null;
	private toolbar: HTMLElement | null = null;

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

		const toolbar = RotationToolbar({ zoomOutRef, zoomInRef, fitRef, resetRef });

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
			</>,
		);

		this.corner = toolbar;
		this.scroller = scrollerRef.value!;
		this.actionBar = this.addChild(new RotationFloatingActionBar(this.rootElem, this.visibility));

		this.ruler = new Ruler(canvasRef.value!);
		this.zoom = new ZoomController({
			scroller: this.scroller,
			labelWidth: () => this.corner.offsetWidth,
			onChange: () => this.schedule(),
		});
		this.zoom.attach();
		this.rowWindow = new TimelineWindow(this.scroller, contentRef.value!, topSpacerRef.value!, bottomSpacerRef.value!, this);

		this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
		this.resizeObserver.observe(this.rootElem);

		zoomOutRef.value!.addEventListener('click', () => this.zoom.stepOut());
		zoomInRef.value!.addEventListener('click', () => this.zoom.stepIn());
		fitRef.value!.addEventListener('click', () => this.zoom.fitToWidth());
		resetRef.value!.addEventListener('click', () => this.zoom.reset());

		this.attachDragPan();

		this.addOnDisposeCallback(this.visibility.subscribe(() => this.onVisibilityChanged()));
		this.addOnDisposeCallback(() => {
			if (this.frame != null) cancelAnimationFrame(this.frame);
			this.scroller.removeEventListener('scroll', this.onScroll);
			this.outerTarget?.removeEventListener('scroll', this.onScroll);
			window.removeEventListener('resize', this.onScroll);
			this.resizeObserver.disconnect();
			this.zoom.dispose();
			this.rowWindow.unmountAll();
		});
	}

	setModel(model: RotationModel | null) {
		this.model = model;
		this.rowWindow.unmountAll();
		this.actionBar.setModel(model);

		if (!model) {
			this.rowWindow.invalidate([], () => 0);
			this.schedule();
			return;
		}

		this.scroller.style.setProperty('--duration', String(model.duration));
		this.zoom.setDuration(model.duration);
		this.measureLabelWidth();
		this.ruler.measure();
		this.rebuildOrder();
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
	}

	private onVisibilityChanged() {
		this.rebuildOrder();
		this.actionBar.sync();
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
		this.measureStickyTop();
		this.schedule();
	}

	// Resolved on the first frame rather than in the constructor: the pane is built before it is in
	// the document, and a walk-up from a detached node would cache the wrong scrollport.
	private attachOuter() {
		if (this.attached || !this.rootElem.isConnected) return;
		this.attached = true;
		this.outer = findScrollParent(this.rootElem);
		this.outerTarget = this.outer ?? window;
		this.outerTarget.addEventListener('scroll', this.onScroll, { passive: true });
		if (this.outer) this.resizeObserver.observe(this.outer);
		else window.addEventListener('resize', this.onScroll, { passive: true });
		this.toolbar = this.rootElem.closest('.dr-root')?.querySelector<HTMLElement>('.dr-toolbar') ?? null;
		if (this.toolbar) this.resizeObserver.observe(this.toolbar);
		this.measureStickyTop();
	}

	private measureStickyTop() {
		const toolbar = this.toolbar;
		// getBoundingClientRect, not offsetHeight: the latter rounds to whole pixels and leaves the
		// ruler a fraction of a pixel behind the toolbar.
		const top = toolbar ? (parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.getBoundingClientRect().height : 0;
		this.rootElem.style.setProperty('--rotation-sticky-top', `${top}px`);
	}

	private viewBounds(): { top: number; bottom: number } {
		const outer = this.outer;
		if (!outer) return { top: 0, bottom: window.innerHeight };
		const rect = outer.getBoundingClientRect();
		return { top: rect.top, bottom: rect.bottom };
	}

	private schedule() {
		if (this.frame != null) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = null;
			this.runFrame();
		});
	}

	// Grab-to-pan. The horizontal scrollbar sits at the far end of the rotation now that the page
	// owns vertical scrolling, so dragging and shift+wheel are the reachable ways to pan.
	private attachDragPan() {
		let pointerId: number | null = null;
		let startX = 0;
		let startScrollLeft = 0;
		let panned = false;

		const onPointerDown = (event: PointerEvent) => {
			if (pointerId !== null || event.button !== 0) return;
			// Leave the eye toggles, the wowhead links and anything else interactive alone.
			if ((event.target as Element).closest('button, a, input, select, textarea')) return;
			pointerId = event.pointerId;
			startX = event.clientX;
			startScrollLeft = this.scroller.scrollLeft;
			panned = false;
			this.scroller.setPointerCapture(event.pointerId);
		};

		const onPointerMove = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			const dx = event.clientX - startX;
			if (!panned) {
				if (Math.abs(dx) < 4) return;
				panned = true;
				this.scroller.classList.add('is-panning');
			}
			this.scroller.scrollLeft = startScrollLeft - dx;
		};

		const endPan = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			if (this.scroller.hasPointerCapture(event.pointerId)) this.scroller.releasePointerCapture(event.pointerId);
			pointerId = null;
			this.scroller.classList.remove('is-panning');
		};

		// A drag ending over an item would otherwise open its tooltip on the trailing click.
		const onClick = (event: MouseEvent) => {
			if (!panned) return;
			panned = false;
			event.preventDefault();
			event.stopPropagation();
		};

		this.scroller.addEventListener('pointerdown', onPointerDown);
		this.scroller.addEventListener('pointermove', onPointerMove);
		this.scroller.addEventListener('pointerup', endPan);
		this.scroller.addEventListener('pointercancel', endPan);
		this.scroller.addEventListener('click', onClick, { capture: true });

		this.addOnDisposeCallback(() => {
			this.scroller.removeEventListener('pointerdown', onPointerDown);
			this.scroller.removeEventListener('pointermove', onPointerMove);
			this.scroller.removeEventListener('pointerup', endPan);
			this.scroller.removeEventListener('pointercancel', endPan);
			this.scroller.removeEventListener('click', onClick, { capture: true });
		});
	}

	private runFrame() {
		if (this.isDisposed) return;
		this.attachOuter();
		const pps = this.zoom.pps;
		const view = this.viewBounds();
		this.rowWindow.update(pps, this.corner.offsetWidth, view.top, view.bottom);
		this.ruler.draw({ scrollLeft: this.scroller.scrollLeft, pps, duration: this.model?.duration ?? 0 });
	}
}
