import i18n from '../../../../i18n/config';
import { IndividualSimUI } from '../../../individual_sim_ui';
import { Player } from '../../../player';
import { APLGroup } from '../../../proto/apl';
import { EventID, TypedEvent } from '../../../typed_event';
import { Component } from '../../component';
import { ListItemPickerConfig, ListPicker } from '../../pickers/list_picker';
import { AplFloatingActionBar } from './apl_floating_action_bar';
import { APLGroupEditor } from './apl_group_editor';
import { APLNameModal } from './apl_name_modal';

export class APLGroupListPicker extends Component {
	constructor(parent: HTMLElement, simUI: IndividualSimUI<any>) {
		super(parent, 'apl-group-list-picker-root');

		const listPicker = new ListPicker<Player<any>, APLGroup>(this.rootElem, simUI.player, {
			title: i18n.t('rotation_tab.apl.actionGroups.header'),
			titleTooltip: i18n.t('rotation_tab.apl.actionGroups.tooltips.overview'),
			extraCssClasses: ['apl-list-item-picker', 'apl-groups-picker'],
			itemLabel: i18n.t('rotation_tab.apl.actionGroups.name'),
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => player.aplRotation.groups || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLGroup>) => {
				player.aplRotation.groups = newValue;
				player.rotationChangeEmitter.emit(eventID);
			},
			newItem: () =>
				APLGroup.create({
					name: i18n.t('rotation_tab.apl.actionGroups.newGroupName'),
					actions: [],
					variables: [],
				}),
			onCopyItem: (index: number) => {
				const groups = simUI.player.aplRotation.groups || [];
				const oldItem = groups[index];
				new APLNameModal(simUI.rootElem, {
					title: i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: i18n.t('rotation_tab.apl.actionGroups.name') }),
					inputLabel: i18n.t('rotation_tab.apl.actionGroups.attributes.name'),
					inputPlaceholder: oldItem.name,
					existingNames: groups.map(g => g.name),
					onSubmit: (name: string) => {
						const newItem = APLGroup.clone(oldItem);
						newItem.name = name;
						const newList = groups.slice();
						newList.splice(index, 0, newItem);
						listPicker.config.setValue(TypedEvent.nextEventID(), simUI.player, newList);
					},
				});
			},
			newItemPicker: (parent: HTMLElement, _: ListPicker<Player<any>, APLGroup>, index: number, config: ListItemPickerConfig<Player<any>, APLGroup>) =>
				new APLGroupEditor(parent, simUI.player, { ...config, index }),
			allowedActions: ['copy', 'delete', 'move'],
			inlineMenuBar: true,
		});

		new AplFloatingActionBar(this.rootElem, simUI, listPicker, {
			itemName: i18n.t('rotation_tab.apl.actionGroups.name'),
			modalTitle: i18n.t('rotation_tab.apl.floatingActionBar.new', { itemName: i18n.t('rotation_tab.apl.actionGroups.name') }),
			inputLabel: i18n.t('rotation_tab.apl.actionGroups.attributes.name'),
			getExistingNames: () => (simUI.player.aplRotation.groups || []).map(g => g.name),
			createItem: (name: string) =>
				APLGroup.create({
					name,
					actions: [],
					variables: [],
				}),
		});
	}
}
