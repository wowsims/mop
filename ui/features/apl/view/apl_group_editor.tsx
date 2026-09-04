import { Player } from '@domain/player';
import { renameAPLReference } from '@domain/proto_utils/apl_utils';
import { randomUUID } from '@domain/utils';
import { APLAction, APLGroup, APLListItem } from '@generated/proto/apl';
import { UUID } from '@generated/proto/common';
import i18n from '@i18n/config';
import { Input, InputConfig } from '@ui-kit/input';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';

import { APLActionPicker } from './apl_actions';
import * as AplHelpers from './apl_helpers';
import { APLNameModal } from './apl_name_modal';
import { APLHidePicker } from './hide_picker';
export interface APLGroupEditorConfig extends InputConfig<Player<any>, APLGroup> {
	index: number;
}

export class APLGroupEditor extends Input<Player<any>, APLGroup> {
	private readonly index: number;
	private readonly nameLabel: HTMLElement;
	private readonly actionsPicker: ListPicker<Player<any>, APLListItem>;
	private readonly actionsContainer: HTMLElement;

	constructor(parent: HTMLElement, player: Player<any>, config: APLGroupEditorConfig) {
		super(parent, 'apl-group-editor-root', player, config);
		this.rootElem.classList.add('apl-list-item-picker-root');
		this.index = config.index;
		const container = this.rootElem.appendChild(<div className="apl-action-picker-root" />) as HTMLElement;

		// Create the group name display with rename button
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
			const group = this.getSourceValue();
			if (!group) return;
			new APLNameModal((this.rootElem.closest('.sim-ui') as HTMLElement) ?? document.body, {
				title: i18n.t('rotation_tab.apl.nameModal.rename', { itemName: i18n.t('rotation_tab.apl.actionGroups.name') }),
				inputLabel: i18n.t('rotation_tab.apl.actionGroups.attributes.name'),
				confirmButtonLabel: i18n.t('rotation_tab.apl.nameModal.renameConfirm'),
				defaultValue: group.name,
				existingNames: () => (player.aplRotation.groups || []).filter(g => g !== group).map(g => g.name),
				onSubmit: (name: string) => {
					player.modifyAplRotation(rotation => {
						renameAPLReference(rotation, { type: 'group', oldName: group.name, newName: name });
						group.name = name;
					});
				},
			});
		});

		// Create a dedicated container for actions that will have full width
		this.actionsContainer = container.appendChild(<div className="apl-group-actions-container" />) as HTMLElement;

		// Create the actions picker in the dedicated container with EXACT same styling as Priority List
		this.actionsPicker = this.addChild(
			new ListPicker<Player<any>, APLListItem>(this.actionsContainer, this.modObject, {
				extraCssClasses: ['apl-list-item-picker'], // Use SAME class as Priority List!
				title: i18n.t('rotation_tab.apl.actionGroups.attributes.actions'),
				titleTooltip: i18n.t('rotation_tab.apl.actionGroups.tooltips.actions'),
				itemLabel: i18n.t('rotation_tab.apl.priorityList.name'),
				actions: {
					create: {
						useIcon: true,
					},
				},
				getValue: () => this.getSourceValue()?.actions || [],
				setValue: (player: Player<any>, newValue: Array<APLListItem>) => {
					const group = this.getSourceValue();
					if (group) {
						group.actions = newValue;
						player.touchRotation();
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
				dragGroup: 'action-group-actions',
				extraActions: [
					AplHelpers.extractToVariableAction(
						player,
						actionIndex => this.getSourceValue()?.actions?.[actionIndex]?.action?.condition,
						(actionIndex, ref) => {
							this.getSourceValue()!.actions[actionIndex].action!.condition = ref;
						},
						(this.rootElem.closest('.sim-ui') as HTMLElement) ?? document.body,
					),
				],
			}),
		);

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
			name: group.name,
			actions: this.actionsPicker.getInputValue(),
		});
	}

	setInputValue(newValue: APLGroup) {
		if (!newValue) {
			return;
		}
		this.nameLabel.textContent = newValue.name || '';
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

		this.hidePicker = this.addChild(
			new APLHidePicker(itemHeaderElem, player, {
				getValue: () => this.getItem().hide,
				setValue: (player: Player<any>, newValue: boolean) => {
					this.getItem().hide = newValue;
					this.player.touchRotation();
				},
			}),
		);

		this.actionPicker = this.addChild(
			new APLActionPicker(this.rootElem, this.modObject, {
				getValue: () => this.getItem().action!,
				setValue: (player: Player<any>, newValue: any) => {
					const item = this.getSourceValue();
					if (item) {
						this.getItem().action = newValue;
						player.touchRotation();
					}
				},
			}),
		);

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
		this.hidePicker.setInputValue(newValue.hide);
		this.actionPicker.setInputValue(newValue.action || APLAction.create());
		if (newValue.action?.condition) {
			if (!newValue.action.condition?.uuid?.value || newValue.action.condition.uuid.value == '') {
				newValue.action.condition.uuid = UUID.create({ value: randomUUID() });
			}
			this.rootElem.id = newValue.action.condition.uuid.value;
		}
	}
}
