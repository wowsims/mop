import i18n from '../../../../i18n/config';
import { Player } from '../../../player';
import { APLAction, APLGroup, APLListItem } from '../../../proto/apl';
import { UUID } from '../../../proto/common';
import { EventID } from '../../../typed_event';
import { randomUUID } from '../../../utils';
import { Input, InputConfig } from '../../input';
import { ListItemPickerConfig, ListPicker } from '../../pickers/list_picker';
import { AdaptiveStringPicker } from '../../pickers/string_picker';
import { APLActionPicker } from '../apl_actions';
import { APLHidePicker } from './hide_picker';

export interface APLGroupEditorConfig extends InputConfig<Player<any>, APLGroup> {
	index: number;
}

export class APLGroupEditor extends Input<Player<any>, APLGroup> {
	private readonly index: number;
	private readonly namePicker: AdaptiveStringPicker<Player<any>>;
	private readonly actionsPicker: ListPicker<Player<any>, APLListItem>;
	private readonly actionsContainer: HTMLElement;

	constructor(parent: HTMLElement, player: Player<any>, config: APLGroupEditorConfig) {
		super(parent, 'apl-group-editor-root', player, config);
		this.rootElem.classList.add('apl-list-item-picker-root');
		this.index = config.index;
		const container = this.rootElem.appendChild(<div className="apl-action-picker-root" />) as HTMLElement;

		// Create the group name input within our container
		this.namePicker = new AdaptiveStringPicker(container, this.modObject, {
			id: randomUUID(),
			label: i18n.t('rotation_tab.apl.actionGroups.attributes.name'),
			labelTooltip: i18n.t('rotation_tab.apl.actionGroups.tooltips.name'),
			extraCssClasses: ['apl-group-name-picker'],
			inline: true,
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => this.getSourceValue()?.name || '',
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				const group = this.getSourceValue();
				if (group) {
					group.name = newValue;
					player.rotationChangeEmitter.emit(eventID);
				}
			},
		});

		// Create a dedicated container for actions that will have full width
		this.actionsContainer = container.appendChild(<div className="apl-group-actions-container" />) as HTMLElement;

		// Create the actions picker in the dedicated container with EXACT same styling as Priority List
		this.actionsPicker = new ListPicker<Player<any>, APLListItem>(this.actionsContainer, this.modObject, {
			extraCssClasses: ['apl-list-item-picker'], // Use SAME class as Priority List!
			title: i18n.t('rotation_tab.apl.actionGroups.attributes.actions'),
			titleTooltip: i18n.t('rotation_tab.apl.actionGroups.tooltips.actions'),
			itemLabel: i18n.t('rotation_tab.apl.priorityList.name'),
			actions: {
				create: {
					useIcon: true,
				},
			},
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => this.getSourceValue()?.actions || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLListItem>) => {
				const group = this.getSourceValue();
				if (group) {
					group.actions = newValue;
					player.rotationChangeEmitter.emit(eventID);
				}
			},
			newItem: () =>
				APLListItem.create({
					action: {},
				}),
			copyItem: (oldItem: APLListItem) => APLListItem.clone(oldItem),
			newItemPicker: (parent: HTMLElement, _: ListPicker<Player<any>, APLListItem>, index, config: ListItemPickerConfig<Player<any>, APLListItem>) =>
				new APLGroupActionPicker(parent, this.modObject, { ...config, groupIndex: this.index, index }),
			inlineMenuBar: true,
			allowedActions: ['create', 'copy', 'delete', 'move'],
		});

		this.init();
	}

	getInputElem(): HTMLElement | null {
		// Return the main container element
		return this.rootElem;
	}

	getInputValue(): APLGroup {
		const group = this.getSourceValue();
		if (!group) {
			return APLGroup.create();
		}

		return APLGroup.create({
			name: this.namePicker.getInputValue(),
			actions: this.actionsPicker.getInputValue(),
		});
	}

	setInputValue(newValue: APLGroup) {
		if (!newValue) {
			return;
		}
		this.namePicker.setInputValue(newValue.name || '');
		this.actionsPicker.setInputValue(newValue.actions || []);
	}
}

export interface APLGroupActionPickerConfig extends ListItemPickerConfig<Player<any>, APLListItem> {
	groupIndex: number;
	index: number;
}
// Simple list item picker for group actions that matches Priority List structure
class APLGroupActionPicker extends Input<Player<any>, APLListItem> {
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

	constructor(parent: HTMLElement, player: Player<any>, config: APLGroupActionPickerConfig) {
		config.enableWhen = () => !this.getItem().hide;
		// Use the same root class as Priority List items for consistent styling
		super(parent, 'apl-list-item-picker-root', player, config);
		this.player = player;

		this.rootElem.classList.add('apl-list-item-picker-root');

		// Add validation support just like Priority List picker
		const itemHeaderElem = ListPicker.getItemHeaderElem(this);

		ListPicker.makeListItemValidations(itemHeaderElem, player, player => {
			const validations = [];
			const groups = player.aplRotation.groups || [];
			if (config.groupIndex < groups.length && groups[config.groupIndex].actions && config.index < groups[config.groupIndex].actions.length) {
				validations.push(...(player.getCurrentStats().rotationStats?.groups?.[config.groupIndex]?.actions?.[config.index]?.validations || []));
			}
			validations.push(...(player.getCurrentStats().rotationStats?.uuidValidations?.find(v => v.uuid?.value === this.rootElem.id)?.validations || []));
			return validations;
		});

		this.hidePicker = new APLHidePicker(itemHeaderElem, player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().hide,
			setValue: (eventID: EventID, player: Player<any>, newValue: boolean) => {
				this.getItem().hide = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.actionPicker = new APLActionPicker(this.rootElem, this.modObject, {
			changedEvent: () => this.modObject.rotationChangeEmitter,
			getValue: () => this.getItem().action!,
			setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
				const item = this.getSourceValue();
				if (item) {
					this.getItem().action = newValue;
					player.rotationChangeEmitter.emit(eventID);
				}
			},
		});

		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLListItem {
		return APLListItem.create({
			action: this.actionPicker.getInputValue(),
		});
	}

	setInputValue(newValue: APLListItem) {
		if (!newValue) {
			return;
		}
		this.actionPicker.setInputValue(newValue.action || APLAction.create());
		if (newValue.action?.condition) {
			if (!newValue.action.condition?.uuid?.value || newValue.action.condition.uuid.value == '') {
				newValue.action.condition.uuid = UUID.create({ value: randomUUID() });
			}
			this.rootElem.id = newValue.action.condition.uuid.value;
		}
	}
}
