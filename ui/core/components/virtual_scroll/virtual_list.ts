import { findScrollParent } from '../../utils';

/**
 * A fixed-row-height virtual list.
 *
 * Rows are pulled from the data source only while they are inside the viewport, so a list of
 * any length costs the same to display. Row height is measured from a rendered row rather
 * than declared, and re-measured when the container resizes.
 */

// Rows kept above and below the viewport so a fast scroll does not show gaps before the
// next frame lands.
const OVERSCAN_ROWS = 10;

export interface VirtualListDataSource {
	count(): number;
	// Builds the row at `index`. Called only for rows entering the window.
	renderRow(index: number): Element;
}

export interface VirtualListOptions {
	// The element that scrolls the list, with the rows starting at its top. Omit when the list
	// sits inside a larger scroller - the nearest scrolling ancestor, or the page - and shares it.
	scrollElem?: HTMLElement;
	// Where rows are written. May be the same element as scrollElem.
	contentElem: HTMLElement;
	dataSource: VirtualListDataSource;
	// Used until a real row has been rendered and measured.
	estimatedRowHeight?: number;
	// Tag for the spacer elements. Must be a legal child of contentElem: 'li' inside a <ul>,
	// 'tr' inside a <tbody>.
	rowTag?: string;
	// Adds a hidden filler when the window starts on an odd index, so :nth-child striping on
	// the rows does not flip as you scroll.
	keepParity?: boolean;
	// Called after the mounted window changes, for state that depends on which rows are in
	// the DOM. Not called per scroll event - only when the window actually moves.
	onRender?: () => void;
	// Shared scroller only: pixels of it covered by sticky chrome above the rows.
	topInset?: () => number;
}

export class VirtualList {
	// Given up front, or resolved on the first render for a shared scroller: a list built before
	// it is in the document would walk up from a detached node and find nothing.
	private scroller: HTMLElement | Window | null;
	private readonly ownScroller: boolean;
	private readonly contentElem: HTMLElement;
	private readonly topInset: () => number;
	private readonly dataSource: VirtualListDataSource;
	private readonly keepParity: boolean;
	private readonly onRender?: () => void;
	private readonly topSpacer: HTMLElement;
	private readonly bottomSpacer: HTMLElement;
	private readonly parityFiller: HTMLElement;

	private rowHeight: number;
	private measured = false;
	// The rows currently in the DOM, so a scroll of one row reuses the rest instead of
	// rebuilding the whole window.
	private rendered = new Map<number, Element>();
	private firstIndex = -1;
	private lastIndex = -1;
	private frame: number | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private disposed = false;

	constructor(options: VirtualListOptions) {
		this.scroller = options.scrollElem ?? null;
		this.ownScroller = !!options.scrollElem;
		this.contentElem = options.contentElem;
		this.topInset = options.topInset ?? (() => 0);
		this.dataSource = options.dataSource;
		this.keepParity = options.keepParity ?? false;
		this.onRender = options.onRender;
		this.rowHeight = options.estimatedRowHeight ?? 32;

		const tag = options.rowTag ?? 'div';
		this.parityFiller = document.createElement(tag);
		this.parityFiller.hidden = true;
		this.topSpacer = document.createElement(tag);
		this.bottomSpacer = document.createElement(tag);

		this.onScroll = this.onScroll.bind(this);
		if (typeof ResizeObserver !== 'undefined') {
			let contentWidth = -1;
			this.resizeObserver = new ResizeObserver(entries => {
				// A resize changes how many rows fit, and can change row height itself. The content
				// element is only watched for its width: every render changes its height through the
				// spacers, and reacting to that from inside the observer is a loop.
				const content = entries.find(entry => entry.target === this.contentElem && !this.ownScroller);
				if (content) {
					if (content.contentRect.width === contentWidth && entries.length === 1) return;
					contentWidth = content.contentRect.width;
				}
				this.measured = false;
				this.onScroll();
			});
			this.resizeObserver.observe(options.scrollElem ?? this.contentElem);
		}
		if (this.scroller) this.listen(this.scroller);
	}

	private listen(scroller: HTMLElement | Window) {
		scroller.addEventListener('scroll', this.onScroll, { passive: true });
		if (scroller instanceof HTMLElement) this.resizeObserver?.observe(scroller);
		else window.addEventListener('resize', this.onScroll, { passive: true });
	}

	private attachScroller(): HTMLElement | Window | null {
		if (!this.scroller && this.contentElem.isConnected) {
			this.scroller = findScrollParent(this.contentElem) ?? window;
			this.listen(this.scroller);
		}
		return this.scroller;
	}

	// Re-reads the row count. Call after the data source's contents change.
	update() {
		this.measured = false;
		this.invalidate();
		this.render();
	}

	scrollToTop() {
		const scroller = this.attachScroller();
		if (this.ownScroller) {
			(scroller as HTMLElement).scrollTop = 0;
		} else if (scroller) {
			const top = this.contentElem.getBoundingClientRect().top - this.visibleTop(scroller);
			if (top < 0) scroller.scrollBy({ top });
		}
		this.update();
	}

	// Runs `callback` over the rows currently on screen, for state that depends on something
	// other than the row's own index.
	updateVisible(callback: (row: Element) => void) {
		this.rendered.forEach(row => callback(row));
	}

	dispose() {
		this.disposed = true;
		this.scroller?.removeEventListener('scroll', this.onScroll);
		window.removeEventListener('resize', this.onScroll);
		this.resizeObserver?.disconnect();
		if (this.frame != null) cancelAnimationFrame(this.frame);
	}

	private onScroll() {
		// One read and one render per frame, not per scroll event.
		if (this.frame != null) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = null;
			if (!this.disposed) this.render();
		});
	}

	private render() {
		this.attachScroller();
		const total = this.dataSource.count();
		if (total === 0) {
			this.invalidate();
			this.contentElem.replaceChildren();
			return;
		}

		const { scrollTop, viewportHeight } = this.viewport();
		const visibleCount = Math.ceil(viewportHeight / this.rowHeight) + OVERSCAN_ROWS * 2;
		const first = Math.min(total - 1, Math.max(0, Math.floor(scrollTop / this.rowHeight) - OVERSCAN_ROWS));
		const last = Math.min(total - 1, first + visibleCount);

		if (first === this.firstIndex && last === this.lastIndex) return;

		const next = new Map<number, Element>();
		const rows: Array<Element> = [];
		for (let i = first; i <= last; i++) {
			const row = this.rendered.get(i) ?? this.dataSource.renderRow(i);
			next.set(i, row);
			rows.push(row);
		}
		this.rendered = next;
		this.firstIndex = first;
		this.lastIndex = last;

		this.topSpacer.style.height = `${first * this.rowHeight}px`;
		this.bottomSpacer.style.height = `${Math.max(0, total - 1 - last) * this.rowHeight}px`;

		const children: Array<Element> = [];
		if (this.keepParity && first % 2 === 0) children.push(this.parityFiller);
		children.push(this.topSpacer, ...rows, this.bottomSpacer);
		this.contentElem.replaceChildren(...children);

		if (!this.measured) this.measureRowHeight(rows[0]);
		this.onRender?.();
	}

	private visibleTop(scroller: HTMLElement | Window): number {
		return (scroller instanceof HTMLElement ? scroller.getBoundingClientRect().top : 0) + this.topInset();
	}

	// In a shared scroller the rows' own top edge stands in for scrollTop: the top spacer sits
	// inside contentElem, so that edge does not move as the window does.
	private viewport(): { scrollTop: number; viewportHeight: number } {
		const scroller = this.scroller;
		if (this.ownScroller) {
			const elem = scroller as HTMLElement;
			return { scrollTop: elem.scrollTop, viewportHeight: elem.clientHeight || this.rowHeight };
		}
		const visibleTop = scroller ? this.visibleTop(scroller) : this.topInset();
		const height = scroller instanceof HTMLElement ? scroller.clientHeight : window.innerHeight;
		return {
			scrollTop: Math.max(0, visibleTop - this.contentElem.getBoundingClientRect().top),
			viewportHeight: Math.max(this.rowHeight, height - this.topInset()),
		};
	}

	private invalidate() {
		this.rendered.clear();
		this.firstIndex = -1;
		this.lastIndex = -1;
	}

	// Measures a real row rather than trusting the estimate. If it disagrees, the offsets
	// just written are wrong, so re-render once with the true height.
	private measureRowHeight(row: Element | undefined) {
		if (!row) return;
		const height = (row as HTMLElement).offsetHeight;
		if (!height) return;
		this.measured = true;
		if (Math.abs(height - this.rowHeight) < 0.5) return;
		this.rowHeight = height;
		this.invalidate();
		this.render();
	}
}
