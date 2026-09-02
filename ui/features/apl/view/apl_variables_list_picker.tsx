import { APLValueVariable } from '@core/proto/apl';
import { UUID } from '@core/proto/common';
import { Player } from '@domain/player';
import { renameAPLReference } from '@domain/proto_utils/apl_utils';
import { EventID, nextEventID } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import { randomUUID } from '@domain/utils';
import type { IndividualSimHost } from '@features/sim_host';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { Input } from '@ui-kit/input';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';

import { AplFloatingActionBar } from './apl_floating_action_bar';
import { APLNameModal } from './apl_name_modal';
import { APLValuePicker } from './apl_values';
export class APLVariablesListPicker extends Component {
	constructor(container: HTMLElement, simUI: IndividualSimHost<any>) {
		super(container, 'apl-variables-list-picker-root');

		const listPicker = new ListPicker<Player<any>, APLValueVariable>(this.rootElem, simUI.player, {
			title: i18n.t('rotation_tab.apl.variables.header'),
			titleTooltip: i18n.t('rotation_tab.apl.variables.tooltips.overview'),
			extraCssClasses: ['apl-list-item-picker', 'apl-value-variables-picker'],
			itemLabel: i18n.t('rotation_tab.apl.variables.name'),
			storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'rotation'),
			getValue: (player: Player<any>) => player.aplRotation.valueVariables || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLValueVariable>) => {
				player.modifyAplRotation(eventID, rotation => {
					rotation.valueVariables = newValue;
				});
			},
			newItem: () => this.createValueVariable(i18n.t('rotation_tab.apl.variables.newVariableName')),
			onCopyItem: (index: number) => {
				const variables = simUI.player.aplRotation.valueVariables || [];
				const oldItem = variables[index];
				new APLNameModal(simUI.rootElem, {
					title: i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: i18n.t('rotation_tab.apl.variables.name') }),
					inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
					inputPlaceholder: oldItem.name,
					existingNames: variables.map(v => v.name),
					onSubmit: (name: string) => {
						const newItem = APLValueVariable.create({ name, value: oldItem.value });
						const newList = variables.slice();
						newList.splice(index, 0, newItem);
						listPicker.config.setValue(nextEventID(), simUI.player, newList);
					},
				});
			},
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

		new AplFloatingActionBar(this.rootElem, simUI, listPicker, {
			itemName: i18n.t('rotation_tab.apl.variables.name'),
			modalTitle: i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: i18n.t('rotation_tab.apl.variables.name') }),
			inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
			getExistingNames: () => (simUI.player.aplRotation.valueVariables || []).map(v => v.name),
			createItem: (name: string) => this.createValueVariable(name),
		});
	}

	private createValueVariable(name: string): APLValueVariable {
		return APLValueVariable.create({
			name,
			value: undefined,
		});
	}
}

class APLValueVariablePicker extends Input<Player<any>, APLValueVariable> {
	private nameLabel: HTMLElement;
	private valuePicker: APLValuePicker;
	private config: ListItemPickerConfig<Player<any>, APLValueVariable>;
	public modObject: Player<any>;

	constructor(parent: HTMLElement, player: Player<any>, index: number, config: ListItemPickerConfig<Player<any>, APLValueVariable>) {
		super(parent, 'apl-value-variable-picker-root', player, config);
		this.rootElem.classList.add('apl-list-item-picker-root');

		this.config = config;
		this.modObject = player;

		const container = this.rootElem.appendChild(<div className="apl-action-picker-root" />) as HTMLElement;

		if (this.rootElem.parentElement!.classList.contains('list-picker-item')) {
			const itemHeaderElem = ListPicker.getItemHeaderElem(this) || this.rootElem;
			ListPicker.makeListItemValidations(
				itemHeaderElem,
				player,
				player => player.getCurrentStats().rotationStats?.uuidValidations?.find(v => v.uuid?.value === this.rootElem.id)?.validations || [],
			);
		}

		this.nameLabel = (<span className="apl-name-value" />) as HTMLElement;

		const nameContainer = container.appendChild(
			<div className="apl-name-display">
				{this.nameLabel}
				<button className="btn btn-link apl-name-rename" type="button">
					<i className="fas fa-pencil-alt" />
				</button>
			</div>,
		) as HTMLElement;

		nameContainer.querySelector('.apl-name-rename')!.addEventListener('click', () => {
			const sourceValue = this.getSourceValue();
			if (!sourceValue) return;
			new APLNameModal((this.rootElem.closest('.individual-sim-ui') as HTMLElement) ?? document.body, {
				title: i18n.t('rotation_tab.apl.nameModal.rename', { itemName: i18n.t('rotation_tab.apl.variables.name') }),
				inputLabel: i18n.t('rotation_tab.apl.variables.attributes.name'),
				confirmButtonLabel: i18n.t('rotation_tab.apl.nameModal.renameConfirm'),
				defaultValue: sourceValue.name,
				existingNames: () => (player.aplRotation.valueVariables || []).filter(v => v !== sourceValue).map(v => v.name),
				onSubmit: (name: string) => {
					player.modifyAplRotation(nextEventID(), rotation => {
						renameAPLReference(rotation, { type: 'variable', oldName: sourceValue.name, newName: name });
						sourceValue.name = name;
					});
				},
			});
		});

		this.valuePicker = new APLValuePicker(container, player, {
			id: randomUUID(),
			label: i18n.t('rotation_tab.apl.variables.attributes.value'),
			labelTooltip: i18n.t('rotation_tab.apl.variables.attributes.valueTooltip'),
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
			name: this.getSourceValue().name,
			value: this.valuePicker.getInputValue(),
		};
	}

	setInputValue(newValue: APLValueVariable) {
		this.nameLabel.textContent = newValue.name;
		this.valuePicker.setInputValue(newValue.value);

		if (newValue.value) {
			if (!newValue.value.uuid || newValue.value.uuid.value == '') {
				newValue.value.uuid = UUID.create({ value: randomUUID() });
			}
			this.rootElem.id = newValue.value.uuid!.value;
		}
	}
}
