import { ref } from 'tsx-vanilla';

import { Player } from '../../player';
import { APLAction, APLGroup, APLListItem } from '../../proto/apl';
import { EventID, TypedEvent } from '../../typed_event';
import { randomUUID } from '../../utils';
import { Component } from '../component';
import { Input, InputConfig } from '../input';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker';
import { AdaptiveStringPicker } from '../pickers/string_picker';
import { APLActionPicker } from './apl_actions';
import { APLValueVariableManager } from './apl_value_variable_manager';

export interface APLGroupEditorConfig extends InputConfig<Player<any>, APLGroup> {}

// Simple action picker for group actions
class APLGroupActionPicker extends Input<Player<any>, APLListItem> {
	private readonly actionPicker: APLActionPicker;

	constructor(parent: HTMLElement, player: Player<any>, config: ListItemPickerConfig<Player<any>, APLListItem>) {
		super(parent, 'apl-list-item-picker-root', player, config);

		this.actionPicker = new APLActionPicker(this.rootElem, this.modObject, {
			changedEvent: () => this.modObject.rotationChangeEmitter,
			getValue: () => this.getSourceValue()?.action || APLAction.create(),
			setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
				const item = this.getSourceValue();
				if (item) {
					item.action = newValue;
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
	}
}

export class APLGroupEditor extends Input<Player<any>, APLGroup> {
	private readonly namePicker: AdaptiveStringPicker<Player<any>>;
	private readonly actionsPicker: ListPicker<Player<any>, APLListItem>;
	private readonly variablesManager: APLValueVariableManager;

	constructor(parent: HTMLElement, player: Player<any>, config: APLGroupEditorConfig) {
		super(parent, 'apl-group-editor-root', player, config);

		this.namePicker = new AdaptiveStringPicker(this.rootElem, this.modObject, {
			id: randomUUID(),
			labelTooltip: 'Name of this action group (e.g., "careful_aim", "cooldowns")',
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

		this.variablesManager = new APLValueVariableManager(this.rootElem, this.modObject, {
			getValue: (player: Player<any>) => this.getSourceValue()?.variables || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: any[]) => {
				const group = this.getSourceValue();
				if (group) {
					group.variables = newValue;
					player.rotationChangeEmitter.emit(eventID);
				}
			},
		});

		this.actionsPicker = new ListPicker<Player<any>, APLListItem>(this.rootElem, this.modObject, {
			extraCssClasses: ['apl-group-actions-picker'],
			title: 'Actions',
			titleTooltip: 'Actions in this group. These will be executed in order when the group is referenced.',
			itemLabel: 'Action',
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
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, APLListItem>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLListItem>,
			) => new APLGroupActionPicker(parent, this.modObject, config),
			inlineMenuBar: true,
		});

		this.init();
	}

	getInputElem(): HTMLElement | null {
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
			variables: this.variablesManager.getInputValue(),
		});
	}

	setInputValue(newValue: APLGroup) {
		if (!newValue) {
			return;
		}
		this.namePicker.setInputValue(newValue.name || '');
		this.variablesManager.setInputValue(newValue.variables || []);
		this.actionsPicker.setInputValue(newValue.actions || []);
	}
}
