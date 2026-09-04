const STEPS: ReadonlyArray<number> = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
const LABEL_MIN_PX = 60;
const MINOR_MIN_PX = 5;

export interface RulerFrame {
	scrollLeft: number;
	pps: number;
	duration: number;
}

function formatTick(time: number, step: number): string {
	if (step >= 60) {
		const minutes = Math.floor(time / 60);
		return `${minutes}:${String(Math.round(time - minutes * 60)).padStart(2, '0')}`;
	}
	return `${Number(time.toFixed(2))}s`;
}

class TickPool {
	private readonly mounted = new Map<number, HTMLElement>();
	private readonly free: Array<HTMLElement> = [];

	constructor(
		private readonly parent: HTMLElement,
		private readonly className: string,
		private readonly apply: (elem: HTMLElement, index: number) => void,
	) {}

	sync(first: number, last: number, reapply: boolean) {
		this.mounted.forEach((elem, index) => {
			if (!reapply && index >= first && index <= last) return;
			this.mounted.delete(index);
			elem.remove();
			this.free.push(elem);
		});
		for (let index = first; index <= last; index++) {
			if (this.mounted.has(index)) continue;
			const elem = this.free.pop() ?? this.build();
			this.apply(elem, index);
			this.parent.appendChild(elem);
			this.mounted.set(index, elem);
		}
	}

	clear() {
		this.mounted.forEach(elem => {
			elem.remove();
			this.free.push(elem);
		});
		this.mounted.clear();
	}

	private build(): HTMLElement {
		const elem = document.createElement('div');
		elem.className = this.className;
		return elem;
	}
}

export class Ruler {
	private readonly minorTicks: TickPool;
	private readonly majorTicks: TickPool;
	private readonly labels: TickPool;

	private labelStep = 0;
	private minorStep = 0;
	private lastScrollLeft = NaN;
	private lastPps = NaN;
	private lastDuration = NaN;
	private lastWidth = NaN;

	constructor(
		private readonly viewport: HTMLElement,
		private readonly track: HTMLElement,
	) {
		this.minorTicks = new TickPool(track, 'rotation-ruler-tick', (elem, index) => elem.style.setProperty('--t', String(index * this.minorStep)));
		this.majorTicks = new TickPool(track, 'rotation-ruler-tick is-major', (elem, index) => elem.style.setProperty('--t', String(index * this.labelStep)));
		this.labels = new TickPool(track, 'rotation-ruler-label', (elem, index) => {
			const time = index * this.labelStep;
			elem.style.setProperty('--t', String(time));
			elem.textContent = formatTick(time, this.labelStep);
			elem.classList.toggle('is-first', index === 0);
		});
	}

	draw({ scrollLeft, pps, duration }: RulerFrame) {
		const width = this.viewport.clientWidth;
		if (width <= 0) return;

		// A vertical page scroll leaves every tick where it was, and that is now the common case:
		// the page owns vertical scrolling, so the frame runs far more often than the ruler moves.
		if (scrollLeft === this.lastScrollLeft && pps === this.lastPps && duration === this.lastDuration && width === this.lastWidth) return;
		this.lastScrollLeft = scrollLeft;
		this.lastPps = pps;
		this.lastDuration = duration;
		this.lastWidth = width;

		this.track.style.setProperty('--pan', String(scrollLeft));

		if (duration <= 0 || pps <= 0) {
			this.minorTicks.clear();
			this.majorTicks.clear();
			this.labels.clear();
			return;
		}

		let labelIndex = STEPS.findIndex(step => step * pps >= LABEL_MIN_PX);
		if (labelIndex < 0) labelIndex = STEPS.length - 1;
		const labelStep = STEPS[labelIndex];
		const minorStep = labelIndex > 0 && STEPS[labelIndex - 1] * pps >= MINOR_MIN_PX ? STEPS[labelIndex - 1] : 0;

		const stepsChanged = labelStep !== this.labelStep || minorStep !== this.minorStep;
		this.labelStep = labelStep;
		this.minorStep = minorStep;

		const startTime = Math.max(0, scrollLeft / pps);
		const endTime = Math.min(duration, (scrollLeft + width) / pps);

		this.majorTicks.sync(Math.ceil(startTime / labelStep), Math.floor(endTime / labelStep), stepsChanged);
		this.labels.sync(Math.ceil(startTime / labelStep), Math.floor(endTime / labelStep), stepsChanged);
		if (minorStep > 0) this.minorTicks.sync(Math.ceil(startTime / minorStep), Math.floor(endTime / minorStep), stepsChanged);
		else this.minorTicks.clear();
	}
}
