import { observeElementRect, useVirtualizer } from '@tanstack/react-virtual';
import type { RectObserver } from '@ui-kit/VirtualList';
import { WINDOW_SCROLLER } from '@ui-kit/VirtualList';
import { cssVars } from '@ui-kit/utils/css';
import { findScrollParent } from '@ui-kit/utils/dom';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useHoverTooltip } from '../../../hooks/useHoverTooltip';
import type { ContentRow, RotationModel, Row } from '../../../model/timeline/rotation';
import { computeOrder, rowAt } from '../../../model/timeline/rotation';
import { NO_ITEMS } from '../../../model/timeline/rotation/row_track';
import type { RowWindow, TrackBand } from '../../../model/timeline/rotation/timeline_window';
import { trackBand, VERTICAL_PADDING_PX } from '../../../model/timeline/rotation/timeline_window';
import { Ruler } from '../../../view/timeline/rotation/ruler';
import { DEFAULT_PPS, ZoomController } from '../../../view/timeline/rotation/zoom';
import { RotationFloatingActionBar } from './RotationFloatingActionBar';
import { RotationHeaderRow } from './RotationHeaderRow';
import { RotationRow } from './RotationRow';
import { RotationRowLabel } from './RotationRowLabel';
import { RotationSeparatorRow } from './RotationSeparatorRow';
import { RotationToolbar } from './RotationToolbar';
import { RowItemTooltip } from './RowItemTooltip';
import type { RotationFrame } from './utils';
import { EMPTY_FRAME, nextFrame } from './utils';

export interface RotationViewProps {
	model: RotationModel | null;
}

const NO_HIDDEN: ReadonlySet<string> = new Set();
const NO_ORDER: ReadonlyArray<string> = [];
const NO_BAND: TrackBand = { left: 0, right: 0 };

/**
 * The virtualizer is shown a scrollport `VERTICAL_PADDING_PX` taller on each edge than the real one,
 * which is how a pixel padding is expressed to something whose own `overscan` counts rows. The top
 * edge rides on `scrollMargin` — starting the measurements that much further down is the same as
 * reading the scroll offset that much earlier — and this carries the bottom.
 *
 * The height is re-read rather than taken from the rect handed in, because `observeElementRect`
 * rounds the border box to whole pixels while row offsets are exact sums of `ROW_HEIGHTS`, so half a
 * pixel at the bottom edge is a whole row in or out. `observeWindowRect` reports `innerHeight`,
 * which is already what the measurement wants.
 */
const padScrollport =
	(observe: RectObserver): RectObserver =>
	(instance, cb) =>
		observe(instance, rect => {
			const element: HTMLElement | Window | null = instance.scrollElement;
			const height = element instanceof HTMLElement ? element.getBoundingClientRect().height : rect.height;
			cb({ width: rect.width, height: height + 2 * VERTICAL_PADDING_PX });
		});

const PADDED_ELEMENT_RECT = padScrollport(observeElementRect);
const PADDED_WINDOW_RECT = padScrollport(WINDOW_SCROLLER.observeElementRect!);

export const RotationView = ({ model }: RotationViewProps) => {
	const rootRef = useRef<HTMLDivElement>(null);
	const cornerRef = useRef<HTMLDivElement>(null);
	const rulerViewportRef = useRef<HTMLDivElement>(null);
	const rulerTrackRef = useRef<HTMLDivElement>(null);
	const scrollerRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const measurerRef = useRef<HTMLDivElement>(null);

	const [hidden, setHidden] = useState(NO_HIDDEN);
	const [labelWidthCss, setLabelWidthCss] = useState('clamp(8rem, 14rem, 20rem)');
	const [stickyTop, setStickyTop] = useState(0);
	const [paneWidth, setPaneWidth] = useState(0);
	const [scrollport, setScrollport] = useState<HTMLElement | Window | null>(null);
	const [scrollMargin, setScrollMargin] = useState(0);
	const [band, setBand] = useState(NO_BAND);
	const [pps, setPps] = useState(DEFAULT_PPS);
	const [measurable, setMeasurable] = useState(false);
	const { ref: tooltipRef, content: hover, show: showTip, moveTo: moveTip, hide: hideTip } = useHoverTooltip<{ rowKey: string; index: number }>();

	const rowFor = useCallback((key: string): Row => rowAt(model!, key), [model]);
	const order = useMemo(() => (model ? computeOrder(model, hidden) : NO_ORDER), [model, hidden]);

	const zoomRef = useRef<ZoomController | null>(null);

	// Keyed on the row rather than the index, so a toggle invalidates the measurements instead of
	// leaving the ones taken against the order it changed.
	const getItemKey = useCallback((index: number) => order[index], [order]);
	// Exact, not estimated: every row carries the `ROW_HEIGHTS` value its kind was built with, so the
	// offsets need no measuring pass and no per-row observer.
	const estimateSize = useCallback((index: number) => rowFor(order[index]).height, [order, rowFor]);
	const scrollsWithWindow = scrollport !== null && !(scrollport instanceof HTMLElement);

	// Hiding a row must not empty the content, even for one commit. Vanilla's did, and that is a real
	// defect: the browser clamps scrollTop against a document momentarily a whole rotation shorter,
	// and the height comes back with the scroll where the clamp left it — an 1105px jump against a
	// real change of one row's 32px. The virtualizer re-measures inside the render the toggle causes,
	// off a scroll offset and a scrollport rect that nothing has invalidated, so the spacers carry
	// the full height across it.
	const virtualizer = useVirtualizer<HTMLElement, HTMLElement>({
		count: order.length,
		getScrollElement: () => scrollport as HTMLElement | null,
		getItemKey,
		estimateSize,
		// The padding is geometric, and `overscan` is a row count.
		overscan: 0,
		scrollMargin,
		...(scrollsWithWindow ? WINDOW_SCROLLER : {}),
		observeElementRect: scrollsWithWindow ? PADDED_WINDOW_RECT : PADDED_ELEMENT_RECT,
	});

	const rows = virtualizer.getVirtualItems();
	const head = rows[0];
	const tail = rows[rows.length - 1];
	const rowWindow: RowWindow = {
		first: head ? head.index : 0,
		last: tail ? tail.index : -1,
		topSpacer: head ? head.start - scrollMargin : 0,
		bottomSpacer: tail ? virtualizer.getTotalSize() - (tail.end - scrollMargin) : 0,
		...band,
	};

	// Written during the render that reads it, because `nextFrame` is idempotent: handed back the
	// frame it just produced, `sameFrame` returns it unchanged, so a repeated render cannot churn the
	// item arrays the rows are memoized on.
	const frameRef = useRef<RotationFrame>(EMPTY_FRAME);
	// The rotation's own scroller measures zero while the chart view holds the pane hidden, and that
	// is the one state its geometry cannot be re-read in. A frame already windowed against this order
	// stays — emptying it would hand the shared scroller a shorter document to clamp against on the
	// way back — but a rebuild landing while hidden brings an order nothing has been measured for,
	// and that one waits for the pane to come back.
	const held = frameRef.current.order === order ? frameRef.current : EMPTY_FRAME;
	const frame = measurable ? nextFrame(frameRef.current, rowWindow, pps, order, rowFor) : held;
	frameRef.current = frame;

	const rulerRef = useRef<Ruler | null>(null);
	const resizeObserverRef = useRef<ResizeObserver | null>(null);
	const frameHandle = useRef<number | null>(null);
	const runFrameRef = useRef<() => void>(() => {});
	const onResizeRef = useRef<() => void>(() => {});
	const labelWidth = useRef(0);
	const rulerWidth = useRef(0);
	const outer = useRef<HTMLElement | null>(null);
	const attached = useRef(false);
	const drToolbar = useRef<HTMLElement | null>(null);

	const schedule = useCallback(() => {
		if (frameHandle.current != null) return;
		frameHandle.current = requestAnimationFrame(() => {
			frameHandle.current = null;
			runFrameRef.current();
		});
	}, []);

	// Both widths follow --label-w — the corner is exactly that wide, the ruler takes the rest — so
	// they only move on a resize or a relabel. Reading them per frame put a layout flush between the
	// row window's writes and the ruler's read, twice per frame that the window moved.
	const measureWidths = useCallback(() => {
		labelWidth.current = cornerRef.current?.offsetWidth ?? 0;
		rulerWidth.current = rulerViewportRef.current?.clientWidth ?? 0;
	}, []);

	const measureStickyTop = useCallback(() => {
		const toolbar = drToolbar.current;
		// getBoundingClientRect, not offsetHeight: the latter rounds to whole pixels and leaves the
		// ruler a fraction of a pixel behind the toolbar.
		setStickyTop(toolbar ? (parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.getBoundingClientRect().height : 0);
	}, []);

	const scrollVerticalBy = useCallback((delta: number) => {
		if (outer.current) outer.current.scrollTop += delta;
		else window.scrollBy(0, delta);
	}, []);

	// Resolved on the first frame rather than at mount: a walk up from a node the browser has not
	// laid out yet would cache the wrong scrollport. A non-`visible` overflow on either axis makes an
	// element a scrollport for both, so the first ancestor that clips vertically is the one the rows
	// are windowed against; the timeline's own scroller carries only the horizontal axis. Nothing
	// listens to it for scroll here — that axis is the virtualizer's, and it subscribes itself.
	const attachOuter = useCallback(() => {
		const root = rootRef.current;
		if (attached.current || !root?.isConnected) return;
		attached.current = true;
		outer.current = findScrollParent(root);
		setScrollport(outer.current ?? window);
		if (outer.current) resizeObserverRef.current?.observe(outer.current);
		else window.addEventListener('resize', schedule, { passive: true });
		drToolbar.current = root.closest('.dr-root')?.querySelector<HTMLElement>('.dr-toolbar') ?? null;
		if (drToolbar.current) resizeObserverRef.current?.observe(drToolbar.current);
		measureStickyTop();
	}, [schedule, measureStickyTop]);

	runFrameRef.current = () => {
		const scroller = scrollerRef.current;
		const content = contentRef.current;
		const zoom = zoomRef.current;
		const ruler = rulerRef.current;
		if (!scroller || !content || !zoom || !ruler) return;

		attachOuter();
		// The first frame can precede the resize observer's opening callback.
		if (!rulerWidth.current) measureWidths();

		// Read before the ruler writes: a read afterwards forces a second layout flush per frame.
		const scrollLeft = scroller.scrollLeft;
		const clientWidth = scroller.clientWidth;
		setPps(zoom.pps);
		setMeasurable(clientWidth > 0);
		// A zero-width scroller is a frame that cannot be measured — a collapsed pane, a hidden tab —
		// so leave both measurements where the last real frame left them rather than empty the list.
		if (clientWidth) {
			const next = trackBand(scrollLeft, clientWidth, labelWidth.current);
			setBand(prev => (prev.left === next.left && prev.right === next.right ? prev : next));
			const outerElement = outer.current;
			// Where the rows begin inside the scrollport that moves them, in that scrollport's own
			// content coordinates. Scrolling leaves it invariant, so it only moves when the layout
			// above the rows does, which is what makes it safe to read on the horizontal axis' frame
			// rather than on the vertical one the virtualizer owns.
			const contentStart =
				content.getBoundingClientRect().top + (outerElement ? outerElement.scrollTop - outerElement.getBoundingClientRect().top : window.scrollY);
			setScrollMargin(contentStart + VERTICAL_PADDING_PX);
		}
		ruler.draw({ scrollLeft, pps: zoom.pps, duration: model?.duration ?? 0, width: rulerWidth.current });
	};

	onResizeRef.current = () => {
		const root = rootRef.current;
		if (root && root.clientWidth !== paneWidth) setPaneWidth(root.clientWidth);
		measureWidths();
		measureStickyTop();
		schedule();
	};

	useEffect(() => {
		const root = rootRef.current;
		const scroller = scrollerRef.current;
		const rulerTrack = rulerTrackRef.current;
		if (!root || !scroller || !rulerTrack) return;

		rulerRef.current = new Ruler(rulerTrack);
		const zoom = new ZoomController({
			scroller,
			// --pps is read by the ruler as well as by the rows, and the ruler is not inside the scroller.
			styleHost: root,
			labelWidth: () => labelWidth.current,
			// The scroller is overflow-y hidden, so vertical keys have to move the page's scroller.
			scrollVerticalBy,
			onChange: schedule,
		});
		zoom.attach();
		zoomRef.current = zoom;

		const observer = new ResizeObserver(() => onResizeRef.current());
		resizeObserverRef.current = observer;
		observer.observe(root);
		scroller.addEventListener('scroll', schedule, { passive: true });

		return () => {
			if (frameHandle.current != null) cancelAnimationFrame(frameHandle.current);
			frameHandle.current = null;
			scroller.removeEventListener('scroll', schedule);
			window.removeEventListener('resize', schedule);
			observer.disconnect();
			resizeObserverRef.current = null;
			zoom.dispose();
			zoomRef.current = null;
			rulerRef.current = null;
			outer.current = null;
			attached.current = false;
			drToolbar.current = null;
		};
	}, [schedule, scrollVerticalBy]);

	// Grab-to-pan. The horizontal scrollbar sits at the far end of the rotation now that the page owns
	// vertical scrolling, so dragging and shift+wheel are the reachable ways to pan.
	useEffect(() => {
		const scroller = scrollerRef.current;
		if (!scroller) return;

		let pointerId: number | null = null;
		let startX = 0;
		let startY = 0;
		let startScrollLeft = 0;
		let startScrollTop = 0;
		let panned = false;
		const scrollTop = () => (outer.current ? outer.current.scrollTop : window.scrollY);

		const onPointerDown = (event: PointerEvent) => {
			// Touch already pans both axes natively; taking the pointer would fight it.
			if (pointerId !== null || event.button !== 0 || event.pointerType === 'touch') return;
			// Leave the eye toggles, the wowhead links and anything else interactive alone.
			if ((event.target as Element).closest('button, a, input, select, textarea')) return;
			pointerId = event.pointerId;
			startX = event.clientX;
			startY = event.clientY;
			startScrollLeft = scroller.scrollLeft;
			startScrollTop = scrollTop();
			panned = false;
			scroller.setPointerCapture(event.pointerId);
		};

		const onPointerMove = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			const dx = event.clientX - startX;
			const dy = event.clientY - startY;
			if (!panned) {
				if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
				panned = true;
				scroller.classList.add('is-panning');
			}
			scroller.scrollLeft = startScrollLeft - dx;
			scrollVerticalBy(startScrollTop - dy - scrollTop());
		};

		const endPan = (event: PointerEvent) => {
			if (event.pointerId !== pointerId) return;
			if (scroller.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId);
			pointerId = null;
			if (event.type === 'pointercancel') panned = false;
			scroller.classList.remove('is-panning');
		};

		// Suppresses the click a pan would otherwise deliver to whatever it ended on.
		const onClick = (event: MouseEvent) => {
			if (!panned) return;
			panned = false;
			event.preventDefault();
			event.stopPropagation();
		};

		scroller.addEventListener('pointerdown', onPointerDown);
		scroller.addEventListener('pointermove', onPointerMove);
		scroller.addEventListener('pointerup', endPan);
		scroller.addEventListener('pointercancel', endPan);
		scroller.addEventListener('click', onClick, { capture: true });
		return () => {
			scroller.removeEventListener('pointerdown', onPointerDown);
			scroller.removeEventListener('pointermove', onPointerMove);
			scroller.removeEventListener('pointerup', endPan);
			scroller.removeEventListener('pointercancel', endPan);
			scroller.removeEventListener('click', onClick, { capture: true });
		};
	}, [scrollVerticalBy]);

	useEffect(() => {
		zoomRef.current?.setDuration(model?.duration ?? 0);
	}, [model]);

	const longestLabel = useMemo(() => {
		let longest = '';
		for (const row of model?.rows ?? []) if (row.kind !== 'separator' && row.label.length > longest.length) longest = row.label;
		return longest;
	}, [model]);

	// Measured off a copy of the widest label rather than assumed: the lg breakpoint that hides
	// `.rotation-label-text` applies inside the pane, so the measurer has to live there too. It is
	// mounted for the one frame the measurement takes and gone again, so the pane's resting DOM is
	// the same as it was before the port.
	const measureInput = `${longestLabel}|${paneWidth}`;
	const [measureFor, setMeasureFor] = useState<string | null>(null);
	const [seenMeasureInput, setSeenMeasureInput] = useState(measureInput);
	if (seenMeasureInput !== measureInput) {
		setSeenMeasureInput(measureInput);
		setMeasureFor(measureInput);
	}

	useLayoutEffect(() => {
		if (measureFor === null) return;
		const measured = measurerRef.current?.firstElementChild as HTMLElement | null;
		if (measured) setLabelWidthCss(`clamp(8rem, ${Math.ceil(measured.offsetWidth)}px, 20rem)`);
		setMeasureFor(null);
	}, [measureFor]);

	useLayoutEffect(() => {
		measureWidths();
	}, [labelWidthCss, measureWidths]);

	// A frame after every render: the guard inside `nextFrame` is what stops it turning into a loop.
	useEffect(schedule);

	const onHide = useCallback((key: string) => setHidden(prev => (prev.has(key) ? prev : new Set(prev).add(key))), []);
	const onToggle = useCallback((key: string) => {
		setHidden(prev => {
			const next = new Set(prev);
			if (!next.delete(key)) next.add(key);
			return next;
		});
	}, []);
	const onShowAll = useCallback(() => setHidden(prev => (prev.size ? NO_HIDDEN : prev)), []);

	// One delegated handler rather than a listener per item: the track holds hundreds of them, and
	// which one the pointer is over is a question the DOM can already answer.
	const onItemOver = (event: ReactMouseEvent<HTMLDivElement>) => {
		const element = (event.target as Element).closest<HTMLElement>('.rotation-item[data-item-index]');
		const rowKey = element?.closest<HTMLElement>('.rotation-row')?.dataset.rowKey;
		if (!element || !rowKey) {
			hideTip();
			return;
		}
		const index = Number(element.dataset.itemIndex);
		const bottom = element.getBoundingClientRect().bottom;
		if (hover?.rowKey !== rowKey || hover.index !== index) showTip({ rowKey, index }, event.clientX, bottom);
		else moveTip(event.clientX, bottom);
	};

	// Horizontal cursor follow: a bar can be wider than the viewport, so its centre is no anchor.
	const onItemMove = (event: ReactMouseEvent<HTMLDivElement>) => {
		if (hover) moveTip(event.clientX);
	};

	const hoveredRow = hover && model?.byKey.has(hover.rowKey) ? rowFor(hover.rowKey) : null;
	const hoveredItem = hoveredRow && hoveredRow.kind !== 'header' && hoveredRow.kind !== 'separator' ? hoveredRow.items[hover!.index] : null;

	return (
		<div
			ref={rootRef}
			className="rotation-pane"
			style={cssVars({ '--label-w': labelWidthCss, '--duration': String(model?.duration ?? 0), '--rotation-sticky-top': `${stickyTop}px` })}>
			<div className="rotation-header">
				<RotationToolbar
					ref={cornerRef}
					onZoomOut={() => zoomRef.current?.stepOut()}
					onZoomIn={() => zoomRef.current?.stepIn()}
					onFit={() => zoomRef.current?.fitToWidth()}
					onReset={() => zoomRef.current?.reset()}
				/>
				<div ref={rulerViewportRef} className="rotation-ruler">
					<div ref={rulerTrackRef} className="rotation-ruler-track" />
				</div>
			</div>
			<div ref={scrollerRef} className="rotation-scroller" tabIndex={0} onMouseOver={onItemOver} onMouseMove={onItemMove} onMouseLeave={hideTip}>
				<div ref={contentRef} className="rotation-content">
					<div className="rotation-vspacer" style={cssVars({ '--vspacer-h': String(frame.window.topSpacer) })} />
					{order.slice(frame.window.first, frame.window.last + 1).map(key => {
						const row = rowFor(key);
						if (row.kind === 'separator') return <RotationSeparatorRow key={key} row={row} />;
						if (row.kind === 'header') return <RotationHeaderRow key={key} row={row} />;
						return <RotationRow key={key} row={row as ContentRow} items={frame.items.get(key) ?? NO_ITEMS} onHide={onHide} />;
					})}
					<div className="rotation-vspacer" style={cssVars({ '--vspacer-h': String(frame.window.bottomSpacer) })} />
				</div>
			</div>
			{measureFor !== null && (
				<div ref={measurerRef} className="rotation-measurer" aria-hidden="true">
					<RotationRowLabel text={longestLabel} icon={<a className="rotation-row-icon" />} onHide={() => undefined} />
				</div>
			)}
			{/* Rendered inline, not portaled: `.hide-threat-metrics` (scss/core/sim_ui/_shared.scss:131) is an
			 * ancestor rule on `.sim-ui`, so a tooltip moved to `document.body` stops obeying the setting —
			 * which is what master's tippy version does. `timeline.mjs` reads `textContent` and so cannot
			 * see the difference. */}
			{hoveredItem && (
				<div ref={tooltipRef} className="timeline-hover-tooltip">
					<RowItemTooltip item={hoveredItem} />
				</div>
			)}
			<RotationFloatingActionBar model={model} hidden={hidden} onToggle={onToggle} onShowAll={onShowAll} />
		</div>
	);
};
