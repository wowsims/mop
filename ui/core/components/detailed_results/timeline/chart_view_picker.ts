export type ChartViewOption = {
	value: string;
	input: HTMLInputElement;
};

export class ChartViewPicker {
	constructor(
		private readonly rootElem: HTMLElement,
		private readonly options: Array<ChartViewOption>,
	) {}

	get value(): string {
		return this.options.find(option => option.input.checked)?.value ?? '';
	}

	set value(next: string) {
		for (const option of this.options) option.input.checked = option.value === next;
	}

	onChange(callback: () => void) {
		this.rootElem.addEventListener('change', callback);
	}
}
