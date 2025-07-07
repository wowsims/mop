import { Player } from '../../player.js';
import { APLValue } from '../../proto/apl.js';
import { EventID } from '../../typed_event.js';
import { randomUUID } from '../../utils.js';
import { Component } from '../component.js';
import { Input, InputConfig } from '../input.js';
import { TextDropdownPicker, TextDropdownValueConfig } from '../pickers/dropdown_picker.jsx';
import { ListPicker } from '../pickers/list_picker.jsx';
import { APLValueKind, APLValuePicker } from './apl_values.js';

export interface APLConditionBuilderConfig extends InputConfig<Player<any>, APLValue | undefined> {}

export class APLConditionBuilder extends Component {
	private valuePicker: Input<Player<any>, any> | null;
	private config: APLConditionBuilderConfig;
	private modObject: Player<any>;

	constructor(parent: HTMLElement, player: Player<any>, config: APLConditionBuilderConfig) {
		super(parent, 'apl-condition-builder-root');
		this.config = config;
		this.modObject = player;

		// For now, let's use the existing APLValuePicker as a base
		// We'll create a simpler version that just wraps the existing picker
		const valuePicker = new APLValuePicker(this.rootElem, player, config);
		this.valuePicker = valuePicker;
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLValue | undefined {
		return this.valuePicker?.getInputValue();
	}

	setInputValue(newValue: APLValue | undefined) {
		this.valuePicker?.setInputValue(newValue);
	}
}
