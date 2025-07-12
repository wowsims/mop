import { Player } from '../../player.js';
import type { APLValueVariable } from '../../proto/apl.js';
import { APLValueVariable as APLValueVariableClass } from '../../proto/apl.js';
import { EventID } from '../../typed_event.js';
import { randomUUID } from '../../utils.js';
import { Component } from '../component.js';
import { Input } from '../input.js';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker.jsx';
import { AdaptiveStringPicker } from '../pickers/string_picker';
import { APLValuePicker } from './apl_values.js';

export interface APLValueVariableManagerConfig {
	getValue: (player: Player<any>) => APLValueVariable[];
	setValue: (eventID: EventID, player: Player<any>, newValue: APLValueVariable[]) => void;
}

export class APLValueVariableManager extends Component {
	private config: APLValueVariableManagerConfig;
	private modObject: Player<any>;
	private listPicker: ListPicker<Player<any>, APLValueVariable>;

	constructor(parent: HTMLElement, player: Player<any>, config: APLValueVariableManagerConfig) {
		super(parent, 'apl-value-variable-manager');
		this.config = config;
		this.modObject = player;

		this.listPicker = new ListPicker(this.rootElem, player, {
			extraCssClasses: ['apl-value-variables-picker'],
			title: 'Value Variables',
			titleTooltip: 'Define reusable variables that can be referenced in your rotation logic.',
			itemLabel: 'Variable',
			newItem: () => this.createValueVariable(),
			copyItem: (oldItem: APLValueVariable) => this.copyValueVariable(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, APLValueVariable>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLValueVariable>,
			) => new APLValueVariablePicker(parent, player, listPicker, index, config),
			allowedActions: ['create', 'copy', 'delete', 'move'],
			actions: {
				create: {
					useIcon: false,
				},
			},
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => this.config.getValue(player),
			setValue: (eventID: EventID, player: Player<any>, newValue: APLValueVariable[]) => this.config.setValue(eventID, player, newValue),
			inlineMenuBar: true,
		});
	}

	private createValueVariable(): APLValueVariable {
		return APLValueVariableClass.create({
			name: '',
			value: undefined,
		});
	}

	private copyValueVariable(oldItem: APLValueVariable): APLValueVariable {
		return APLValueVariableClass.create({
			name: oldItem.name + ' Copy',
			value: oldItem.value,
		});
	}

	getInputValue(): APLValueVariable[] {
		return this.listPicker.getInputValue();
	}

	setInputValue(newValue: APLValueVariable[]) {
		this.listPicker.setInputValue(newValue);
	}

	getListPicker(): ListPicker<Player<any>, APLValueVariable> {
		return this.listPicker;
	}
}

class APLValueVariablePicker extends Input<Player<any>, APLValueVariable> {
	private namePicker: AdaptiveStringPicker<Player<any>>;
	private valuePicker: APLValuePicker;
	private config: ListItemPickerConfig<Player<any>, APLValueVariable>;
	public modObject: Player<any>;
	private index: number;

	constructor(
		parent: HTMLElement,
		player: Player<any>,
		listPicker: ListPicker<Player<any>, APLValueVariable>,
		index: number,
		config: ListItemPickerConfig<Player<any>, APLValueVariable>,
	) {
		super(parent, 'apl-value-variable-picker', player, config);
		this.config = config;
		this.modObject = player;
		this.index = index;

		this.namePicker = new AdaptiveStringPicker(this.rootElem, player, {
			id: randomUUID(),
			label: 'Variable Name',
			labelTooltip: 'Name of the variable (e.g., "my_dot_remains", "boss_health_pct")',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => this.getSourceValue().name,
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				const sourceValue = this.getSourceValue();
				sourceValue.name = newValue;
				this.config.setValue(eventID, player, this.config.getValue(player));
			},
		});

		this.valuePicker = new APLValuePicker(this.rootElem, player, {
			id: randomUUID(),
			label: 'Variable Value',
			labelTooltip: 'The value expression that this variable represents',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => this.getSourceValue().value,
			setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
				const sourceValue = this.getSourceValue();
				sourceValue.value = newValue;
				this.config.setValue(eventID, player, this.config.getValue(player));
			},
		});

		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLValueVariable {
		return {
			name: this.namePicker.getInputValue(),
			value: this.valuePicker.getInputValue(),
		};
	}

	setInputValue(newValue: APLValueVariable) {
		this.namePicker.setInputValue(newValue.name);
		this.valuePicker.setInputValue(newValue.value);
	}
}
