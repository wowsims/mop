import { Player } from '../../player';
import { APLAction, APLGroup, APLListItem, APLPrepullAction, APLValue, APLValueVariable, APLValueVariable as APLValueVariableClass } from '../../proto/apl';
import { SimUI } from '../../sim_ui';
import { EventID, TypedEvent } from '../../typed_event';
import { randomUUID } from '../../utils';
import { Component } from '../component';
import { Input, InputConfig } from '../input';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker';
import { AdaptiveStringPicker } from '../pickers/string_picker';
import { APLActionPicker } from './apl_actions';
import { APLGroupEditor } from './apl_group_editor';
import { APLValueImplStruct, APLValuePicker } from './apl_values';

export class APLRotationTabs extends Component {
	private activeTab = 'priority-list';
	private tabs: Map<string, HTMLElement> = new Map();
	private tabButtons: Map<string, HTMLElement> = new Map();
	private modPlayer: Player<any>;
	private priorityListPicker: ListPicker<Player<any>, APLListItem> | null = null;
	private prepullListPicker: ListPicker<Player<any>, APLPrepullAction> | null = null;
	private groupsListPicker: ListPicker<Player<any>, APLGroup> | null = null;
	private variablesListPicker: ListPicker<Player<any>, APLValueVariable> | null = null;

	constructor(parent: HTMLElement, simUI: SimUI, modPlayer: Player<any>) {
		super(parent, 'apl-rotation-tabs-root');
		this.modPlayer = modPlayer;

		this.createTabStructure();
		this.createTabs();
		this.showTab('priority-list');
	}

	private createTabStructure() {
		// Create tab navigation
		const tabNav = document.createElement('ul');
		tabNav.className = 'nav nav-tabs apl-rotation-nav-tabs';
		tabNav.setAttribute('role', 'tablist');
		this.rootElem.appendChild(tabNav);

		// Create tab content container
		const tabContent = document.createElement('div');
		tabContent.className = 'tab-content apl-rotation-tab-content';
		this.rootElem.appendChild(tabContent);

		// Define tab structure
		const tabConfig = [
			{ id: 'priority-list', label: 'Priority List', icon: 'fa-list-ol' },
			{ id: 'prepull', label: 'Prepull', icon: 'fa-clock' },
			{ id: 'groups', label: 'Action Groups', icon: 'fa-layer-group' },
			{ id: 'variables', label: 'Variables', icon: 'fa-code' },
		];

		// Create tab buttons and content areas
		tabConfig.forEach(tab => {
			// Create tab button
			const tabButton = document.createElement('li');
			tabButton.className = 'nav-item';
			tabButton.setAttribute('role', 'presentation');

			const tabLink = document.createElement('button');
			tabLink.className = 'nav-link';
			tabLink.setAttribute('type', 'button');
			tabLink.setAttribute('role', 'tab');
			tabLink.setAttribute('aria-controls', `${tab.id}-tab-pane`);
			tabLink.setAttribute('aria-selected', 'false');
			tabLink.innerHTML = `<i class="fas ${tab.icon}"></i> ${tab.label}`;

			tabLink.addEventListener('click', () => this.showTab(tab.id));

			tabButton.appendChild(tabLink);
			tabNav.appendChild(tabButton);
			this.tabButtons.set(tab.id, tabLink);

			// Create tab content area
			const tabPane = document.createElement('div');
			tabPane.className = 'tab-pane fade';
			tabPane.id = `${tab.id}-tab-pane`;
			tabPane.setAttribute('role', 'tabpanel');
			tabPane.setAttribute('aria-labelledby', `${tab.id}-tab`);
			tabContent.appendChild(tabPane);
			this.tabs.set(tab.id, tabPane);
		});

		// Create floating new button container that will be positioned in the tab bar
		const newButtonContainer = document.createElement('div');
		newButtonContainer.className = 'apl-tab-new-button-container';
		tabNav.appendChild(newButtonContainer);
	}

	private showTab(tabId: string) {
		// Update button states
		this.tabButtons.forEach((button, id) => {
			if (id === tabId) {
				button.classList.add('active');
				button.setAttribute('aria-selected', 'true');
			} else {
				button.classList.remove('active');
				button.setAttribute('aria-selected', 'false');
			}
		});

		// Update content visibility
		this.tabs.forEach((tab, id) => {
			if (id === tabId) {
				tab.classList.add('show', 'active');
			} else {
				tab.classList.remove('show', 'active');
			}
		});

		// Update the new button in the tab bar
		this.updateNewButton(tabId);

		this.activeTab = tabId;
	}

	private updateNewButton(tabId: string) {
		const buttonContainer = this.rootElem.querySelector('.apl-tab-new-button-container') as HTMLElement;
		if (!buttonContainer) return;

		// Clear existing button
		buttonContainer.innerHTML = '';

		// Get the new button configuration for this tab
		const buttonConfig = this.getNewButtonConfig(tabId);
		if (buttonConfig) {
			const newButton = document.createElement('button');
			newButton.className = 'btn btn-primary apl-tab-new-button';
			newButton.textContent = buttonConfig.text;
			newButton.addEventListener('click', buttonConfig.callback);
			buttonContainer.appendChild(newButton);
		}
	}

	private getNewButtonConfig(tabId: string): { text: string; callback: () => void } | null {
		switch (tabId) {
			case 'priority-list':
				return {
					text: 'New Action',
					callback: () => this.addNewPriorityListItem(),
				};
			case 'prepull':
				return {
					text: 'New Prepull Action',
					callback: () => this.addNewPrepullAction(),
				};
			case 'groups':
				return {
					text: 'New Group',
					callback: () => this.addNewGroup(),
				};
			case 'variables':
				return {
					text: 'New Variable',
					callback: () => this.addNewVariable(),
				};
			default:
				return null;
		}
	}

	private createTabs() {
		this.createPriorityListTab();
		this.createPrepullTab();
		this.createGroupsTab();
		this.createVariablesTab();
	}

	private createPriorityListTab() {
		const tabPane = this.tabs.get('priority-list')!;

		this.priorityListPicker = new ListPicker<Player<any>, APLListItem>(tabPane, this.modPlayer, {
			extraCssClasses: ['apl-list-item-picker'],
			itemLabel: 'Action',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => player.aplRotation.priorityList,
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLListItem>) => {
				player.aplRotation.priorityList = newValue;
				player.rotationChangeEmitter.emit(eventID);
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
			) => new APLListItemPicker(parent, this.modPlayer, config, index),
			allowedActions: ['create', 'copy', 'delete', 'move'],
			inlineMenuBar: true,
		});
	}

	private createPrepullTab() {
		const tabPane = this.tabs.get('prepull')!;

		this.prepullListPicker = new ListPicker<Player<any>, APLPrepullAction>(tabPane, this.modPlayer, {
			extraCssClasses: ['apl-prepull-action-picker'],
			itemLabel: 'Prepull Action',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => player.aplRotation.prepullActions,
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLPrepullAction>) => {
				player.aplRotation.prepullActions = newValue;
				player.rotationChangeEmitter.emit(eventID);
			},
			newItem: () =>
				APLPrepullAction.create({
					action: {},
					doAtValue: {
						value: { oneofKind: 'const', const: { val: '-1s' } },
					},
				}),
			copyItem: (oldItem: APLPrepullAction) => APLPrepullAction.clone(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, APLPrepullAction>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLPrepullAction>,
			) => new APLPrepullActionPicker(parent, this.modPlayer, config, index),
			allowedActions: ['create', 'copy', 'delete', 'move'],
			inlineMenuBar: true,
		});
	}

	private createGroupsTab() {
		const tabPane = this.tabs.get('groups')!;

		this.groupsListPicker = new ListPicker<Player<any>, APLGroup>(tabPane, this.modPlayer, {
			extraCssClasses: ['apl-groups-picker'],
			itemLabel: 'Group',
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (player: Player<any>) => player.aplRotation.groups || [],
			setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLGroup>) => {
				player.aplRotation.groups = newValue;
				player.rotationChangeEmitter.emit(eventID);
			},
			newItem: () =>
				APLGroup.create({
					name: 'new_group',
					actions: [],
					variables: [],
				}),
			copyItem: (oldItem: APLGroup) => APLGroup.clone(oldItem),
			newItemPicker: (
				parent: HTMLElement,
				listPicker: ListPicker<Player<any>, APLGroup>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLGroup>,
			) => new APLGroupEditor(parent, this.modPlayer, config),
			allowedActions: ['create', 'copy', 'delete', 'move'],
			inlineMenuBar: true,
		});
	}

	private createVariablesTab() {
		const tabPane = this.tabs.get('variables')!;

		this.variablesListPicker = new ListPicker<Player<any>, APLValueVariable>(tabPane, this.modPlayer, {
			extraCssClasses: ['apl-value-variables-picker'],
			itemLabel: 'Variable',
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
				listPicker: ListPicker<Player<any>, APLValueVariable>,
				index: number,
				config: ListItemPickerConfig<Player<any>, APLValueVariable>,
			) => new APLValueVariablePicker(parent, this.modPlayer, listPicker, index, config),
			allowedActions: ['create', 'copy', 'delete', 'move'],
			actions: {
				create: {
					useIcon: false,
				},
			},
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

	private addNewPriorityListItem() {
		if (this.priorityListPicker) {
			const newItem = this.priorityListPicker.config.newItem();
			const newList = this.priorityListPicker.config.getValue(this.priorityListPicker.modObject).concat([newItem]);
			this.priorityListPicker.config.setValue(TypedEvent.nextEventID(), this.priorityListPicker.modObject, newList);
		}
	}

	private addNewPrepullAction() {
		if (this.prepullListPicker) {
			const newItem = this.prepullListPicker.config.newItem();
			const newList = this.prepullListPicker.config.getValue(this.prepullListPicker.modObject).concat([newItem]);
			this.prepullListPicker.config.setValue(TypedEvent.nextEventID(), this.prepullListPicker.modObject, newList);
		}
	}

	private addNewGroup() {
		if (this.groupsListPicker) {
			const newItem = this.groupsListPicker.config.newItem();
			const newList = this.groupsListPicker.config.getValue(this.groupsListPicker.modObject).concat([newItem]);
			this.groupsListPicker.config.setValue(TypedEvent.nextEventID(), this.groupsListPicker.modObject, newList);
		}
	}

	private addNewVariable() {
		if (this.variablesListPicker) {
			const newItem = this.createValueVariable();
			const newList = this.variablesListPicker.config.getValue(this.variablesListPicker.modObject).concat([newItem]);
			this.variablesListPicker.config.setValue(TypedEvent.nextEventID(), this.variablesListPicker.modObject, newList);
		}
	}
}

// These classes are copied from the original apl_rotation_picker.ts
// We'll need to extract them to a shared file or keep them here for now

class APLPrepullActionPicker extends Input<Player<any>, APLPrepullAction> {
	private readonly player: Player<any>;
	private readonly hidePicker: Input<Player<any>, boolean>;
	private readonly doAtPicker: Input<Player<any>, string>;
	private readonly actionPicker: APLActionPicker;

	private getItem(): APLPrepullAction {
		return (
			this.getSourceValue() ||
			APLPrepullAction.create({
				action: {},
			})
		);
	}

	constructor(parent: HTMLElement, player: Player<any>, config: ListItemPickerConfig<Player<any>, APLPrepullAction>, index: number) {
		config.enableWhen = () => !this.getItem().hide;
		super(parent, 'apl-list-item-picker-root', player, config);
		this.player = player;

		const itemHeaderElem = ListPicker.getItemHeaderElem(this);
		ListPicker.makeListItemValidations(itemHeaderElem, player, player => player.getCurrentStats().rotationStats?.prepullActions[index]?.validations || []);

		this.hidePicker = new HidePicker(itemHeaderElem, player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().hide,
			setValue: (eventID: EventID, player: Player<any>, newValue: boolean) => {
				this.getItem().hide = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.doAtPicker = new AdaptiveStringPicker(this.rootElem, this.player, {
			id: randomUUID(),
			label: 'Do At',
			labelTooltip: "Time before pull to do the action. Should be negative, and formatted like, '-1s' or '-2500ms'.",
			extraCssClasses: ['apl-prepull-actions-doat'],
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => (this.getItem().doAtValue?.value as APLValueImplStruct<'const'> | undefined)?.const.val || '',
			setValue: (eventID: EventID, player: Player<any>, newValue: string) => {
				if (newValue) {
					this.getItem().doAtValue = APLValue.create({
						value: { oneofKind: 'const', const: { val: newValue } },
						uuid: { value: randomUUID() },
					});
				} else {
					this.getItem().doAtValue = undefined;
				}
				this.player.rotationChangeEmitter.emit(eventID);
			},
			inline: true,
		});

		this.actionPicker = new APLActionPicker(this.rootElem, this.player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().action!,
			setValue: (eventID: EventID, player: Player<any>, newValue: APLAction) => {
				this.getItem().action = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
			},
		});
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLPrepullAction {
		const item = APLPrepullAction.create({
			hide: this.hidePicker.getInputValue(),
			doAtValue: {
				value: { oneofKind: 'const', const: { val: this.doAtPicker.getInputValue() } },
			},
			action: this.actionPicker.getInputValue(),
		});
		return item;
	}

	setInputValue(newValue: APLPrepullAction) {
		if (!newValue) {
			return;
		}
		this.hidePicker.setInputValue(newValue.hide);
		this.doAtPicker.setInputValue((newValue.doAtValue?.value as APLValueImplStruct<'const'> | undefined)?.const.val || '');
		this.actionPicker.setInputValue(newValue.action || APLAction.create());
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
		ListPicker.makeListItemValidations(itemHeaderElem, player, player => player.getCurrentStats().rotationStats?.priorityList[index]?.validations || []);

		this.hidePicker = new HidePicker(itemHeaderElem, player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().hide,
			setValue: (eventID: EventID, player: Player<any>, newValue: boolean) => {
				this.getItem().hide = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.actionPicker = new APLActionPicker(this.rootElem, this.player, {
			changedEvent: () => this.player.rotationChangeEmitter,
			getValue: () => this.getItem().action!,
			setValue: (eventID: EventID, player: Player<any>, newValue: APLAction) => {
				this.getItem().action = newValue;
				this.player.rotationChangeEmitter.emit(eventID);
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
	}
}

class HidePicker extends Input<Player<any>, boolean> {
	private readonly inputElem: HTMLElement;
	private readonly iconElem: HTMLElement;
	private tooltip: any; // TippyInstance type would need import

	constructor(parent: HTMLElement, modObject: Player<any>, config: InputConfig<Player<any>, boolean>) {
		super(parent, 'hide-picker-root', modObject, config);

		this.inputElem = ListPicker.makeActionElem('hide-picker-button', 'fa-eye');
		this.iconElem = this.inputElem.childNodes[0] as HTMLElement;

		this.inputElem.addEventListener(
			'click',
			() => {
				this.setInputValue(!this.getInputValue());
				this.inputChanged(TypedEvent.nextEventID());
			},
			{ signal: this.signal },
		);

		this.rootElem.appendChild(this.inputElem);
		// TODO: Add tooltip back with proper import
		// this.tooltip = tippy(this.inputElem, { content: 'Enable/Disable' });

		this.init();
	}

	getInputElem(): HTMLElement {
		return this.inputElem;
	}

	getInputValue(): boolean {
		return this.iconElem.classList.contains('fa-eye-slash');
	}

	setInputValue(newValue: boolean) {
		if (newValue) {
			this.iconElem.classList.add('fa-eye-slash');
			this.iconElem.classList.remove('fa-eye');
			// TODO: Update tooltip when available
		} else {
			this.iconElem.classList.add('fa-eye');
			this.iconElem.classList.remove('fa-eye-slash');
			// TODO: Update tooltip when available
		}
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
		super(parent, 'apl-value-variable-picker-root', player, config);
		this.config = config;
		this.modObject = player;
		this.index = index;

		// Add consistent layout styling
		this.rootElem.classList.add('d-flex', 'flex-column', 'gap-2');

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
