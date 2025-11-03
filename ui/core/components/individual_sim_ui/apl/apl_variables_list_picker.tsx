import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { Player } from '../../../player';
import { APLValueVariable } from '../../../proto/apl';
import { UUID } from '../../../proto/common';
import { EventID } from '../../../typed_event';
import { randomUUID } from '../../../utils';
import { Component } from '../../component';
import { Input } from '../../input';
import { ListItemPickerConfig, ListPicker } from '../../pickers/list_picker';
import { AdaptiveStringPicker } from '../../pickers/string_picker';
import { APLValuePicker } from '../apl_values';
import { AplFloatingActionBar } from './apl_floating_action_bar';

export class APLVariablesListPicker extends Component {
	constructor(container: HTMLElement, simUI: IndividualSimUI<any>) {
		super(container, 'apl-variables-list-picker-root');

		const listPicker = new ListPicker<Player<any>, APLValueVariable>(this.rootElem, simUI.player, {
			title: i18n.t('rotation_tab.apl.variables.header'),
			titleTooltip: i18n.t('rotation_tab.apl.variables.tooltips.overview'),
			extraCssClasses: ['apl-list-item-picker', 'apl-value-variables-picker'],
			itemLabel: i18n.t('rotation_tab.apl.variables.name'),
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => player.aplRotation.valueVariables || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLValueVariable>) => {
				player.aplRotation.valueVariables = newValue;
				player.rotationChangeEmitter.emit(eventID);
			},
			newItem: () => this.createValueVariable(),
			copyItem: (oldItem: APLValueVariable) => this.copyValueVariable(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				_: ListPicker<Player<any>, APLValueVariable>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLValueVariable>,
			) => new APLValueVariablePicker(parent, simUI.player, index, config),
			allowedActions: ['copy', 'delete', 'move'],
			actions: {
				create: {
					useIcon: false,
				},
			},
			inlineMenuBar: true,
		});

		new AplFloatingActionBar(this.rootElem, simUI, listPicker, i18n.t('rotation_tab.apl.variables.name'));
	}

	private createValueVariable(): APLValueVariable {
		return APLValueVariable.create({
			name: i18n.t('rotation_tab.apl.variables.newVariableName'),
			value: undefined,
		});
	}

	private copyValueVariable(oldItem: APLValueVariable): APLValueVariable {
		return APLValueVariable.create({
			name: i18n.t('rotation_tab.apl.variables.copyName', { variableName: oldItem.name }),
			value: oldItem.value,
		});
	}
}

class APLValueVariablePicker extends Input<Player<any>, APLValueVariable> {
	private namePicker: AdaptiveStringPicker<Player<any>>;
	private valuePicker: APLValuePicker;
	private config: ListItemPickerConfig<Player<any>, APLValueVariable>;
	public modObject: Player<any>;
	private index: number;

	constructor(parent: HTMLElement, player: Player<any>, index: number, config: ListItemPickerConfig<Player<any>, APLValueVariable>) {
		super(parent, 'apl-value-variable-picker-root', player, config);
		this.rootElem.classList.add('apl-list-item-picker-root');

		this.config = config;
		this.modObject = player;
		this.index = index;

		const container = this.rootElem.appendChild(<div className="apl-action-picker-root" />) as HTMLElement;

		if (this.rootElem.parentElement!.classList.contains('list-picker-item')) {
			const itemHeaderElem = ListPicker.getItemHeaderElem(this) || this.rootElem;
			ListPicker.makeListItemValidations(
				itemHeaderElem,
				player,
				player => player.getCurrentStats().rotationStats?.uuidValidations?.find(v => v.uuid?.value === this.rootElem.id)?.validations || [],
			);
		}

		this.namePicker = new AdaptiveStringPicker(container, player, {
			id: randomUUID(),
			label: i18n.t('rotation_tab.apl.variables.attributes.name'),
			labelTooltip: i18n.t('rotation_tab.apl.variables.attributes.nameTooltip'),
			extraCssClasses: ['apl-variable-name-picker'],
			inline: true,
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => this.getSourceValue().name,
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				const sourceValue = this.getSourceValue();
				sourceValue.name = newValue;
				this.config.setValue(eventID, player, this.config.getValue(player));
			},
		});

		this.valuePicker = new APLValuePicker(container, player, {
			id: randomUUID(),
			label: i18n.t('rotation_tab.apl.variables.attributes.value'),
			labelTooltip: i18n.t('rotation_tab.apl.variables.attributes.valueTooltip'),
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

		if (newValue.value) {
			if (!newValue.value.uuid || newValue.value.uuid.value == '') {
				newValue.value.uuid = UUID.create({ value: randomUUID() });
			}
			this.rootElem.id = newValue.value.uuid!.value;
		}
	}
}
