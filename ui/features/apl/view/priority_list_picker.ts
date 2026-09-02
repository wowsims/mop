import { APLAction, APLListItem } from '@core/proto/apl';
import { Player } from '@domain/player';
import { EventID } from '@domain/state/batch';
import { subscribePlayerField } from '@domain/state/subscriptions';
import i18n from '@i18n/config';
import { Component } from '@ui-kit/component';
import { Input } from '@ui-kit/input';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';

import type { IndividualSimHost } from '../../sim_host';
import { APLActionPicker } from './apl_actions';
import { AplFloatingActionBar } from './apl_floating_action_bar';
import * as AplHelpers from './apl_helpers';
import { APLHidePicker } from './hide_picker';
export class APLPriorityListPicker extends Component {
	constructor(container: HTMLElement, simUI: IndividualSimHost<any>) {
		super(container, 'apl-priority-list-picker-root');

		const listPicker = new ListPicker<Player<any>, APLListItem>(this.rootElem, simUI.player, {
			title: i18n.t('rotation_tab.apl.priorityList.header'),
			titleTooltip: i18n.t('rotation_tab.apl.priorityList.tooltips.overview'),
			extraCssClasses: ['apl-list-item-picker'],
			itemLabel: i18n.t('rotation_tab.apl.priorityList.name'),
			storeSubscribe: (player: Player<any>) => subscribePlayerField(player, 'rotation'),
			getValue: (player: Player<any>) => player.aplRotation.priorityList,
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLListItem>) => {
				player.modifyAplRotation(eventID, rotation => {
					rotation.priorityList = newValue;
				});
			},
			newItem: () => APLListItem.create({ action: {} }),
			copyItem: (oldItem: APLListItem) => APLListItem.clone(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				_: ListPicker<Player<any>, APLListItem>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLListItem>,
			) => new APLListItemPicker(parent, simUI.player, config, index),
			allowedActions: ['copy', 'delete', 'move'],
			inlineMenuBar: true,
			extraActions: [
				AplHelpers.extractToVariableAction(
					simUI.player,
					index => simUI.player.aplRotation.priorityList[index]?.action?.condition,
					(index, ref) => {
						simUI.player.aplRotation.priorityList[index].action!.condition = ref;
					},
					simUI.rootElem,
				),
			],
		});

		new AplFloatingActionBar(this.rootElem, simUI, listPicker, {
			itemName: i18n.t('rotation_tab.apl.priorityList.name'),
		});
	}
}

class APLListItemPicker extends Input<Player<any>, APLListItem> {
	private readonly player: Player<any>;
	private readonly hidePicker: Input<Player<any>, boolean>;
	private readonly actionPicker: APLActionPicker;

	private getItem(): APLListItem {
		return (
			this.getSourceValue() ||
			APLListItem.create({
				action: {},
			})
		);
	}

	constructor(parent: HTMLElement, player: Player<any>, config: ListItemPickerConfig<Player<any>, APLListItem>, index: number) {
		config.enableWhen = () => !this.getItem().hide;
		super(parent, 'apl-list-item-picker-root', player, config);
		this.player = player;

		const itemHeaderElem = ListPicker.getItemHeaderElem(this);
		ListPicker.makeListItemValidations(itemHeaderElem, player, player => {
			const validations = player.getCurrentStats().rotationStats?.priorityList[index]?.validations || [];
			validations.push(...(player.getCurrentStats().rotationStats?.uuidValidations?.find(v => v.uuid?.value === this.rootElem.id)?.validations || []));
			return validations;
		});

		this.hidePicker = new APLHidePicker(itemHeaderElem, player, {
			getValue: () => this.getItem().hide,
			setValue: (eventID: EventID, player: Player<any>, newValue: boolean) => {
				this.getItem().hide = newValue;
				this.player.touchRotation(eventID);
			},
		});

		this.actionPicker = new APLActionPicker(this.rootElem, this.player, {
			getValue: () => this.getItem().action!,
			setValue: (eventID: EventID, player: Player<any>, newValue: APLAction) => {
				this.getItem().action = newValue;
				this.player.touchRotation(eventID);
			},
		});
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLListItem {
		const item = APLListItem.create({
			hide: this.hidePicker.getInputValue(),
			action: this.actionPicker.getInputValue(),
		});
		return item;
	}

	setInputValue(newValue: APLListItem) {
		if (!newValue) {
			return;
		}
		this.hidePicker.setInputValue(newValue.hide);
		this.actionPicker.setInputValue(newValue.action || APLAction.create());
		if (newValue.action?.condition?.uuid?.value) {
			this.rootElem.id = newValue.action?.condition?.uuid?.value;
		}
	}
}
