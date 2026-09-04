import type { ContentRow, RowItem } from './model';

export interface ItemRenderer {
	build(item: RowItem): HTMLElement;
	update(elem: HTMLElement, item: RowItem): void;
}

export class RowTrack {
	private readonly mounted = new Map<number, HTMLElement>();
	private readonly wanted = new Set<number>();
	private readonly free = new Map<string, Array<HTMLElement>>();
	private lastLeft = NaN;
	private lastRight = NaN;
	private lastPps = NaN;

	constructor(
		private readonly row: ContentRow,
		private readonly trackElem: HTMLElement,
		private readonly renderer: ItemRenderer,
	) {}

	setWindow(left: number, right: number, pps: number) {
		if (left === this.lastLeft && right === this.lastRight && pps === this.lastPps) return;
		this.lastLeft = left;
		this.lastRight = right;
		this.lastPps = pps;

		const { items, maxRightUpTo } = this.row;
		const leftTime = left / pps;
		const rightTime = right / pps;

		let lo = 0;
		let hi = items.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (items[mid].start <= rightTime) lo = mid + 1;
			else hi = mid;
		}

		const wanted = this.wanted;
		wanted.clear();
		for (let i = lo - 1; i >= 0 && maxRightUpTo[i] >= leftTime; i--) {
			if (items[i].end >= leftTime) wanted.add(i);
		}

		this.mounted.forEach((elem, index) => {
			if (!wanted.has(index)) {
				this.mounted.delete(index);
				this.release(items[index].kind, elem);
			}
		});

		for (const index of [...wanted].sort((a, b) => a - b)) {
			if (this.mounted.has(index)) continue;
			const elem = this.acquire(items[index]);
			this.trackElem.appendChild(elem);
			this.mounted.set(index, elem);
		}
	}

	clear() {
		this.mounted.forEach(elem => elem.remove());
		this.mounted.clear();
		this.free.clear();
		this.lastLeft = NaN;
		this.lastRight = NaN;
		this.lastPps = NaN;
	}

	private acquire(item: RowItem): HTMLElement {
		const elem = this.free.get(item.kind)?.pop();
		if (!elem) return this.renderer.build(item);
		this.renderer.update(elem, item);
		return elem;
	}

	// tippy's delegate caches the rendered content against the element the first time it is
	// hovered, so an element that already carries an instance cannot be handed to another item.
	private release(kind: string, elem: HTMLElement) {
		elem.remove();
		if ((elem as { _tippy?: unknown })._tippy) return;
		let pool = this.free.get(kind);
		if (!pool) {
			pool = [];
			this.free.set(kind, pool);
		}
		pool.push(elem);
	}
}
