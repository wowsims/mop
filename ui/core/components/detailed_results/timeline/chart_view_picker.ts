export class ChartViewPicker {
	private readonly inputs: Array<HTMLInputElement>;
	private readonly optionElems = new Map<string, Array<HTMLElement>>();

	constructor(private readonly rootElem: HTMLElement) {
		this.inputs = [...rootElem.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
		for (const input of this.inputs) {
			this.optionElems.set(input.value, [...rootElem.querySelectorAll<HTMLElement>(`.${input.value}-option`)]);
		}
	}

	get value(): string {
		return this.inputs.find(input => input.checked)?.value ?? '';
	}

	set value(next: string) {
		for (const input of this.inputs) input.checked = input.value === next;
	}

	setOptionVisible(option: string, visible: boolean) {
		for (const elem of this.optionElems.get(option) ?? []) elem.classList.toggle('hide', !visible);
	}

	onChange(callback: () => void) {
		this.rootElem.addEventListener('change', callback);
	}
}
