export const HORIZONTAL_PADDING_PX = 600;
export const VERTICAL_PADDING_PX = 200;

export interface WindowHost {
	acquireRow(key: string): HTMLElement;
	releaseRow(key: string, elem: HTMLElement): void;
	windowRow(key: string, left: number, right: number, pps: number): void;
}

export class TimelineWindow {
	private order: ReadonlyArray<string> = [];
	private offsets = new Float64Array(1);
	private readonly mounted = new Map<string, HTMLElement>();
	private readonly wanted = new Set<string>();
	private lastFirst = -1;
	private lastLast = -2;
	private lastLeft = NaN;
	private lastRight = NaN;
	private lastPps = NaN;

	constructor(
		private readonly scroller: HTMLElement,
		private readonly content: HTMLElement,
		private readonly topSpacer: HTMLElement,
		private readonly bottomSpacer: HTMLElement,
		private readonly host: WindowHost,
	) {}

	invalidate(order: ReadonlyArray<string>, heightOf: (key: string) => number) {
		this.order = order;
		const offsets = new Float64Array(order.length + 1);
		for (let i = 0; i < order.length; i++) offsets[i + 1] = offsets[i] + heightOf(order[i]);
		this.offsets = offsets;
		this.resetGuard();
	}

	unmountAll() {
		this.mounted.forEach((elem, key) => this.host.releaseRow(key, elem));
		this.mounted.clear();
		this.resetGuard();
	}

	update(pps: number, labelWidth: number) {
		const count = this.order.length;
		if (count === 0) {
			this.unmountAll();
			this.setSpacer(this.topSpacer, 0);
			this.setSpacer(this.bottomSpacer, 0);
			return;
		}

		const scroller = this.scroller;
		const clientHeight = scroller.clientHeight;
		const clientWidth = scroller.clientWidth;
		if (!clientHeight || !clientWidth) return;

		const total = this.offsets[count];
		const first = this.indexAt(Math.max(0, scroller.scrollTop - VERTICAL_PADDING_PX));
		const last = this.indexAt(Math.min(total, scroller.scrollTop + clientHeight + VERTICAL_PADDING_PX));
		const left = scroller.scrollLeft - HORIZONTAL_PADDING_PX;
		// The sticky label occludes the first labelWidth of every track, so the unobscured
		// track range is [scrollLeft, scrollLeft + clientWidth - labelWidth].
		const right = scroller.scrollLeft + clientWidth - labelWidth + HORIZONTAL_PADDING_PX;

		if (first === this.lastFirst && last === this.lastLast && left === this.lastLeft && right === this.lastRight && pps === this.lastPps) return;
		this.lastFirst = first;
		this.lastLast = last;
		this.lastLeft = left;
		this.lastRight = right;
		this.lastPps = pps;

		this.setSpacer(this.topSpacer, this.offsets[first]);
		this.setSpacer(this.bottomSpacer, total - this.offsets[last + 1]);

		const wanted = this.wanted;
		wanted.clear();
		for (let i = first; i <= last; i++) wanted.add(this.order[i]);

		this.mounted.forEach((elem, key) => {
			if (!wanted.has(key)) {
				this.mounted.delete(key);
				this.host.releaseRow(key, elem);
			}
		});

		let anchor: Node = this.bottomSpacer;
		for (let i = last; i >= first; i--) {
			const key = this.order[i];
			let elem = this.mounted.get(key);
			if (!elem) {
				elem = this.host.acquireRow(key);
				this.mounted.set(key, elem);
			}
			if (elem.nextSibling !== anchor) this.content.insertBefore(elem, anchor);
			anchor = elem;
		}

		for (let i = first; i <= last; i++) this.host.windowRow(this.order[i], left, right, pps);
	}

	private setSpacer(spacer: HTMLElement, height: number) {
		spacer.style.setProperty('--vspacer-h', String(Math.max(0, height)));
	}

	private indexAt(y: number): number {
		let lo = 0;
		let hi = this.order.length - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (this.offsets[mid] <= y) lo = mid;
			else hi = mid - 1;
		}
		return lo;
	}

	private resetGuard() {
		this.lastFirst = -1;
		this.lastLast = -2;
		this.lastLeft = NaN;
		this.lastRight = NaN;
		this.lastPps = NaN;
	}
}
