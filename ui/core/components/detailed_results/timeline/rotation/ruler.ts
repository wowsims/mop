export const RULER_HEIGHT_PX = 30;

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

// The canvas is sized to the viewport rather than the fight: canvas.width caps at 65,535px,
// so a full-fight ruler renders blank past ~262s at 250px/s.
export class Ruler {
	private cssWidth = 0;
	private dpr = 0;
	private color = '#fff';
	private font = 'bold 14px sans-serif';

	constructor(private readonly canvas: HTMLCanvasElement) {}

	// var(--bs-*) never reaches a canvas context, so the CSS-resolved values are read off the
	// element itself and cached until the layout changes.
	measure() {
		const style = getComputedStyle(this.canvas);
		this.color = style.color;
		this.font = `bold ${style.fontSize} ${style.fontFamily}`;
	}

	draw({ scrollLeft, pps, duration }: RulerFrame) {
		const canvas = this.canvas;
		const width = canvas.clientWidth;
		if (width <= 0) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		// Writing width/height clears the bitmap and resets every context attribute.
		if (width !== this.cssWidth || dpr !== this.dpr) {
			this.cssWidth = width;
			this.dpr = dpr;
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(RULER_HEIGHT_PX * dpr);
		}

		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, RULER_HEIGHT_PX);
		if (duration <= 0 || pps <= 0) return;

		ctx.font = this.font;
		ctx.fillStyle = this.color;
		ctx.strokeStyle = this.color;
		ctx.lineWidth = 1;
		ctx.textBaseline = 'top';

		let labelIndex = STEPS.findIndex(step => step * pps >= LABEL_MIN_PX);
		if (labelIndex < 0) labelIndex = STEPS.length - 1;
		const labelStep = STEPS[labelIndex];
		const minorStep = labelIndex > 0 && STEPS[labelIndex - 1] * pps >= MINOR_MIN_PX ? STEPS[labelIndex - 1] : 0;

		const startTime = Math.max(0, scrollLeft / pps);
		const endTime = Math.min(duration, (scrollLeft + width) / pps);

		ctx.beginPath();
		ctx.moveTo(0, RULER_HEIGHT_PX - 0.5);
		ctx.lineTo(width, RULER_HEIGHT_PX - 0.5);

		if (minorStep > 0) {
			for (let i = Math.ceil(startTime / minorStep); i * minorStep <= endTime; i++) {
				const x = Math.round(i * minorStep * pps - scrollLeft) + 0.5;
				ctx.moveTo(x, RULER_HEIGHT_PX);
				ctx.lineTo(x, RULER_HEIGHT_PX - 5);
			}
		}

		for (let i = Math.ceil(startTime / labelStep); i * labelStep <= endTime; i++) {
			const time = i * labelStep;
			const x = Math.round(time * pps - scrollLeft) + 0.5;
			ctx.moveTo(x, RULER_HEIGHT_PX);
			ctx.lineTo(x, RULER_HEIGHT_PX - 12);
			ctx.textAlign = time === 0 ? 'left' : 'center';
			ctx.fillText(formatTick(time, labelStep), x, 2);
		}

		ctx.stroke();
	}
}
