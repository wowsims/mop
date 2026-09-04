/** @jsxImportSource @jsx-vanilla */
import { Input, InputConfig } from '../input';
export interface EnumValueConfig {
	name: string;
	value: number;
	tooltip?: string;
}

export interface EnumPickerConfig<ModObject> extends InputConfig<ModObject, number> {
	id: string;
	values: Array<EnumValueConfig>;
}

export class EnumPicker<ModObject> extends Input<ModObject, number> {
	private readonly selectElem: HTMLSelectElement;

	constructor(parent: HTMLElement | null, modObject: ModObject, config: EnumPickerConfig<ModObject>) {
		super(parent, 'enum-picker-root', modObject, config);

		this.selectElem = this.rootElem.appendChild(
			<select id={config.id} className="enum-picker-selector form-select">
				{config.values.map(value => (
					<option value={String(value.value)} title={value.tooltip}>
						{value.name}
					</option>
				))}
			</select>,
		) as HTMLSelectElement;

		this.init();

		this.selectElem.addEventListener(
			'change',
			() => {
				this.inputChanged();
			},
			{ signal: this.signal },
		);
	}

	getInputElem(): HTMLElement {
		return this.selectElem;
	}

	getInputValue(): number {
		return Number(this.selectElem.value);
	}

	setInputValue(newValue: number) {
		this.selectElem.value = String(newValue);
	}
}