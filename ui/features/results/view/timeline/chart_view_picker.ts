export type ChartViewOption = {
	value: string;
	input: HTMLInputElement;
	// The input and its label; both have to be hidden together.
	elems: Array<HTMLElement>;
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

	setOptionVisible(value: string, visible: boolean) {
		const option = this.options.find(candidate => candidate.value === value);
		if (!option) return;
		for (const elem of option.elems) elem.classList.toggle('hide', !visible);
	}

	onChange(callback: () => void) {
		this.rootElem.addEventListener('change', callback);
	}
}
