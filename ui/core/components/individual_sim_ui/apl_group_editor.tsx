import { Player } from '../../player';
import { APLAction, APLGroup, APLListItem } from '../../proto/apl';
import { EventID } from '../../typed_event';
import { randomUUID } from '../../utils';
import { Input, InputConfig } from '../input';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker';
import { AdaptiveStringPicker } from '../pickers/string_picker';
import { APLActionPicker } from './apl_actions';

export interface APLGroupEditorConfig extends InputConfig<Player<any>, APLGroup> {}

// Simple list item picker for group actions that matches Priority List structure
class APLGroupActionPicker extends Input<Player<any>, APLListItem> {
	private readonly actionPicker: APLActionPicker;

	constructor(parent: HTMLElement, player: Player<any>, config: ListItemPickerConfig<Player<any>, APLListItem>) {
		// Use the same root class as Priority List items for consistent styling
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
	private readonly actionsContainer: HTMLElement;

	constructor(parent: HTMLElement, player: Player<any>, config: APLGroupEditorConfig) {
		super(parent, 'apl-group-editor-root', player, config);

		// Create the group name input within our container
		this.namePicker = new AdaptiveStringPicker(this.rootElem, this.modObject, {
			id: randomUUID(),
			label: 'Group Name',
			labelTooltip: 'Name of this action group (e.g., "careful_aim", "cooldowns")',
			extraCssClasses: ['apl-group-name-input'],
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
		this.actionsContainer = document.createElement('div');
		this.actionsContainer.className = 'apl-group-actions-container';
		this.rootElem.appendChild(this.actionsContainer);

		// Create the actions picker in the dedicated container with EXACT same styling as Priority List
		this.actionsPicker = new ListPicker<Player<any>, APLListItem>(this.actionsContainer, this.modObject, {
			extraCssClasses: ['apl-list-item-picker'], // Use SAME class as Priority List!
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
