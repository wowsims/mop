export const MIN_PPS = 1;
export const MAX_PPS = 400;
export const DEFAULT_PPS = 100;
export const PPS_LADDER: ReadonlyArray<number> = [2, 5, 10, 20, 35, 50, 75, 100, 150, 200, 300, 400];

export type Density = 'fine' | 'medium' | 'coarse';

export function densityForPps(pps: number): Density {
	if (pps >= 60) return 'fine';
	if (pps >= 20) return 'medium';
	return 'coarse';
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export interface ZoomConfig {
	scroller: HTMLElement;
	// --pps is read by the ruler as well as by the rows, and the ruler is not inside the scroller.
	styleHost: HTMLElement;
	labelWidth: () => number;
	// The scroller is overflow-y hidden, so vertical keys have to move the page's scroller.
	scrollVerticalBy: (delta: number) => void;
	onChange: () => void;
}

export class ZoomController {
	private ppsValue = DEFAULT_PPS;
	private duration = 0;
	private readonly cleanups: Array<() => void> = [];

	constructor(private readonly config: ZoomConfig) {
		this.apply();
	}

	get pps(): number {
		return this.ppsValue;
	}

	setDuration(duration: number) {
		this.duration = duration;
	}

	zoomTo(pps: number, anchorClientX?: number) {
		const scroller = this.config.scroller;
		const next = clamp(pps, MIN_PPS, MAX_PPS);
		if (next === this.ppsValue) return;

		const labelWidth = this.config.labelWidth();
		const viewWidth = Math.max(0, scroller.clientWidth - labelWidth);
		const anchorX =
			anchorClientX == null ? labelWidth + viewWidth / 2 : clamp(anchorClientX - scroller.getBoundingClientRect().left, labelWidth, scroller.clientWidth);
		const anchorTime = clamp((scroller.scrollLeft + anchorX - labelWidth) / this.ppsValue, 0, this.duration);

		this.ppsValue = next;
		this.apply();
		scroller.scrollLeft = anchorTime * next + labelWidth - anchorX;
		this.config.onChange();
	}

	stepIn(anchorClientX?: number) {
		const next = PPS_LADDER.find(step => step > this.ppsValue + 1e-6);
		this.zoomTo(next ?? MAX_PPS, anchorClientX);
	}

	stepOut(anchorClientX?: number) {
		let next = MIN_PPS;
		for (const step of PPS_LADDER) {
			if (step < this.ppsValue - 1e-6) next = step;
		}
		this.zoomTo(next, anchorClientX);
	}

	reset() {
		this.zoomTo(DEFAULT_PPS);
	}

	fitToWidth() {
		const scroller = this.config.scroller;
		const width = scroller.clientWidth - this.config.labelWidth();
		if (width <= 0 || this.duration <= 0) return;
		this.zoomTo(width / this.duration);
		scroller.scrollLeft = 0;
		this.config.onChange();
	}

	attach() {
		const scroller = this.config.scroller;

		const onWheel = (event: WheelEvent) => {
			if (!event.ctrlKey && !event.metaKey) return;
			// Without preventDefault the browser takes ctrl+wheel as a page zoom.
			event.preventDefault();
			const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
			this.zoomTo(this.ppsValue * Math.exp(-delta * 0.002), event.clientX);
		};
		scroller.addEventListener('wheel', onWheel, { passive: false });
		this.cleanups.push(() => scroller.removeEventListener('wheel', onWheel));

		const onKeyDown = (event: KeyboardEvent) => {
			if (event.altKey || event.ctrlKey || event.metaKey) return;
			const page = Math.max(64, scroller.clientWidth - this.config.labelWidth());
			switch (event.key) {
				case '+':
				case '=':
					this.stepIn();
					break;
				case '-':
				case '_':
					this.stepOut();
					break;
				case '0':
					this.reset();
					break;
				case 'Home':
					scroller.scrollLeft = 0;
					break;
				case 'End':
					scroller.scrollLeft = scroller.scrollWidth;
					break;
				case 'ArrowLeft':
					scroller.scrollLeft -= page * 0.25;
					break;
				case 'ArrowRight':
					scroller.scrollLeft += page * 0.25;
					break;
				case 'ArrowUp':
					this.config.scrollVerticalBy(-64);
					break;
				case 'ArrowDown':
					this.config.scrollVerticalBy(64);
					break;
				default:
					return;
			}
			event.preventDefault();
		};
		scroller.addEventListener('keydown', onKeyDown);
		this.cleanups.push(() => scroller.removeEventListener('keydown', onKeyDown));
	}

	dispose() {
		this.cleanups.splice(0).forEach(cleanup => cleanup());
	}

	private apply() {
		this.config.styleHost.style.setProperty('--pps', `${this.ppsValue}px`);
		this.config.scroller.dataset.density = densityForPps(this.ppsValue);
	}
}
