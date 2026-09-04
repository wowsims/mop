export class WindowedRow {
	private readonly items: Array<{ left: number; right: number; build: () => Element; elem?: Element }> = [];
	private readonly mounted = new Set<number>();
	// Reused across frames: mount() runs for every row on every animation frame.
	private readonly wanted = new Set<number>();
	// Running max of `right` over items[0..i], so the back-scan can stop as soon as no
	// earlier item can still reach the window.
	private readonly maxRightUpTo: Array<number> = [];
	private sorted = false;

	constructor(private readonly rowElem: Element) {}

	add(left: number, width: number, build: () => Element) {
		this.items.push({ left, right: left + width, build });
		this.sorted = false;
	}

	private sort() {
		// A DoT's ticks can outlast the next cast, so items are not added in x order.
		this.items.sort((a, b) => a.left - b.left);
		this.maxRightUpTo.length = 0;
		let max = -Infinity;
		for (const item of this.items) {
			max = Math.max(max, item.right);
			this.maxRightUpTo.push(max);
		}
		this.sorted = true;
	}

	mount(windowLeft: number, windowRight: number) {
		if (!this.sorted) this.sort();

		// First item whose left edge is past the window; everything at or after it is out.
		let lo = 0;
		let hi = this.items.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (this.items[mid].left <= windowRight) lo = mid + 1;
			else hi = mid;
		}

		const wanted = this.wanted;
		wanted.clear();
		for (let i = lo - 1; i >= 0 && this.maxRightUpTo[i] >= windowLeft; i--) {
			if (this.items[i].right >= windowLeft) wanted.add(i);
		}

		this.mounted.forEach(index => {
			if (!wanted.has(index)) {
				this.items[index].elem!.remove();
				this.mounted.delete(index);
			}
		});

		const ascending = [...wanted].sort((a, b) => a - b);
		for (const index of ascending) {
			if (this.mounted.has(index)) continue;
			const item = this.items[index];
			item.elem ??= item.build();
			this.rowElem.appendChild(item.elem);
			this.mounted.add(index);
		}
	}
}
