import { Player } from '@domain/player';
import { nextEventID } from '@domain/state/batch';
import { Input, InputConfig } from '@ui-kit/input';
import { ListPicker } from '@ui-kit/pickers/list_picker';
export class APLHidePicker extends Input<Player<any>, boolean> {
	private readonly inputElem: HTMLElement;
	private readonly iconElem: HTMLElement;
	private tooltip: any; // TippyInstance type would need import

	constructor(parent: HTMLElement, modObject: Player<any>, config: InputConfig<Player<any>, boolean>) {
		super(parent, 'hide-picker-root', modObject, config);

		this.inputElem = ListPicker.makeActionElem('hide-picker-button', 'fa-eye');
		this.iconElem = this.inputElem.childNodes[0] as HTMLElement;

		this.inputElem.addEventListener(
			'click',
			() => {
				this.setInputValue(!this.getInputValue());
				this.inputChanged(nextEventID());
			},
			{ signal: this.signal },
		);

		this.rootElem.appendChild(this.inputElem);
		// TODO: Add tooltip back with proper import
		// this.tooltip = tippy(this.inputElem, { content: 'Enable/Disable' });

		this.init();
	}

	getInputElem(): HTMLElement {
		return this.inputElem;
	}

	getInputValue(): boolean {
		return this.iconElem.classList.contains('fa-eye-slash');
	}

	setInputValue(newValue: boolean) {
		if (newValue) {
			this.iconElem.classList.add('fa-eye-slash');
			this.iconElem.classList.remove('fa-eye');
			// TODO: Update tooltip when available
		} else {
			this.iconElem.classList.add('fa-eye');
			this.iconElem.classList.remove('fa-eye-slash');
			// TODO: Update tooltip when available
		}
	}
}
