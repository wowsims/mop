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
	scrollElem: HTMLElement;
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
}

export class VirtualList {
	private readonly scrollElem: HTMLElement;
	private readonly contentElem: HTMLElement;
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
		this.scrollElem = options.scrollElem;
		this.contentElem = options.contentElem;
		this.dataSource = options.dataSource;
		this.keepParity = options.keepParity ?? false;
		this.onRender = options.onRender;
		this.rowHeight = options.estimatedRowHeight ?? 32;

		const tag = options.rowTag ?? 'div';
		this.parityFiller = document.createElement(tag);
		this.parityFiller.hidden = true;
		this.topSpacer = document.createElement(tag);
		this.topSpacer.className = 'virtual-list-spacer';
		this.bottomSpacer = document.createElement(tag);
		this.bottomSpacer.className = 'virtual-list-spacer';

		this.onScroll = this.onScroll.bind(this);
		this.scrollElem.addEventListener('scroll', this.onScroll, { passive: true });

		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => {
				// A resize changes how many rows fit, and can change row height itself.
				this.measured = false;
				this.render();
			});
			this.resizeObserver.observe(this.scrollElem);
		}
	}

	// Re-reads the row count. Call after the data source's contents change.
	update() {
		this.measured = false;
		this.invalidate();
		this.render();
	}

	scrollToTop() {
		this.scrollElem.scrollTop = 0;
		this.update();
	}

	// Runs `callback` over the rows currently on screen, for state that depends on something
	// other than the row's own index.
	updateVisible(callback: (row: Element) => void) {
		this.rendered.forEach(row => callback(row));
	}

	dispose() {
		this.disposed = true;
		this.scrollElem.removeEventListener('scroll', this.onScroll);
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
		const total = this.dataSource.count();
		if (total === 0) {
			this.invalidate();
			this.contentElem.replaceChildren();
			return;
		}

		const viewportHeight = this.scrollElem.clientHeight || this.rowHeight;
		const visibleCount = Math.ceil(viewportHeight / this.rowHeight) + OVERSCAN_ROWS * 2;
		const first = Math.min(total - 1, Math.max(0, Math.floor(this.scrollElem.scrollTop / this.rowHeight) - OVERSCAN_ROWS));
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

		this.topSpacer.style.setProperty('--vl-top', String(first * this.rowHeight));
		this.bottomSpacer.style.setProperty('--vl-bottom', String(Math.max(0, total - 1 - last) * this.rowHeight));

		const children: Array<Element> = [];
		if (this.keepParity && first % 2 === 0) children.push(this.parityFiller);
		children.push(this.topSpacer, ...rows, this.bottomSpacer);
		this.contentElem.replaceChildren(...children);

		if (!this.measured) this.measureRowHeight(rows[0]);
		this.onRender?.();
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
