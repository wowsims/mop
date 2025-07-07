import { Player } from '../../player.js';
import { APLConditionVariable } from '../../proto/apl.js';
import { EventID } from '../../typed_event.js';
import { randomUUID } from '../../utils.js';
import { Component } from '../component.js';
import { Input } from '../input.js';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker.jsx';
import { AdaptiveStringPicker } from '../pickers/string_picker';
import { APLConditionBuilder } from './apl_condition_builder.js';

export interface APLConditionVariableManagerConfig {
	getValue: (player: Player<any>) => APLConditionVariable[];
	setValue: (eventID: EventID, player: Player<any>, newValue: APLConditionVariable[]) => void;
}

export class APLConditionVariableManager extends Component {
	private config: APLConditionVariableManagerConfig;
	private listPicker: ListPicker<Player<any>, APLConditionVariable>;

	constructor(parent: HTMLElement, player: Player<any>, config: APLConditionVariableManagerConfig) {
		super(parent, 'apl-condition-variable-manager-root');
		this.config = config;

		this.listPicker = new ListPicker(this.rootElem, player, {
			title: 'Condition Variables',
			itemLabel: 'Condition Variable',
			newItem: () => this.createConditionVariable(),
			copyItem: (oldItem: APLConditionVariable) => this.copyConditionVariable(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, APLConditionVariable>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLConditionVariable>,
			) => new APLConditionVariablePicker(parent, player, listPicker, index, config),
			hideUi: false,
			inlineMenuBar: true,
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => this.config.getValue(player) ?? [],
			setValue: (eventID: EventID, player: Player<any>, newValue: APLConditionVariable[]) => this.config.setValue(eventID, player, newValue),
		});
	}

	private createConditionVariable(): APLConditionVariable {
		return APLConditionVariable.create({
			name: 'New Condition',
			value: undefined,
		});
	}

	private copyConditionVariable(oldItem: APLConditionVariable): APLConditionVariable {
		return APLConditionVariable.create({
			name: oldItem.name + ' Copy',
			value: oldItem.value,
		});
	}
}

class APLConditionVariablePicker extends Input<Player<any>, APLConditionVariable> {
	private nameInput: AdaptiveStringPicker<Player<any>>;
	private conditionBuilder: APLConditionBuilder;
	private listPicker: ListPicker<Player<any>, APLConditionVariable>;
	private index: number;
	private config: ListItemPickerConfig<Player<any>, APLConditionVariable>;

	constructor(
		parent: HTMLElement,
		player: Player<any>,
		listPicker: ListPicker<Player<any>, APLConditionVariable>,
		index: number,
		config: ListItemPickerConfig<Player<any>, APLConditionVariable>,
	) {
		super(parent, 'apl-condition-variable-picker-root', player, config);
		this.listPicker = listPicker;
		this.index = index;
		this.config = config;

		this.nameInput = new AdaptiveStringPicker(this.rootElem, player, {
			id: randomUUID(),
			label: 'Name',
			labelTooltip: 'Name of this condition variable',
			inline: true,
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => this.getSourceValue().name,
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				const sourceValue = this.getSourceValue();
				sourceValue.name = newValue;
				player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.conditionBuilder = new APLConditionBuilder(this.rootElem, player, {
			label: 'Condition',
			labelTooltip: 'The condition logic for this variable',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => this.getSourceValue().value,
			setValue: (eventID: EventID, player: Player<any>, newValue) => {
				const sourceValue = this.getSourceValue();
				sourceValue.value = newValue;
				player.rotationChangeEmitter.emit(eventID);
			},
		});
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLConditionVariable {
		return {
			name: this.nameInput.getInputValue(),
			value: this.conditionBuilder.getInputValue(),
		};
	}

	setInputValue(newValue: APLConditionVariable) {
		this.nameInput.setInputValue(newValue.name);
		this.conditionBuilder.setInputValue(newValue.value);
	}

	public getSourceValue(): APLConditionVariable {
		const raw = this.config.getValue(this.modObject);
		const arr: APLConditionVariable[] = Array.isArray(raw) ? raw : raw ? [raw as APLConditionVariable] : [];
		return arr[this.index] || { name: '', value: undefined };
	}
}
