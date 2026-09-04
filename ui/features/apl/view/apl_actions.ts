import { Player } from '@domain/player';
import { randomUUID } from '@domain/utils';
import { APLAction, APLValue } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { Input, InputConfig } from '@ui-kit/input';
import { TextDropdownPicker } from '@ui-kit/pickers/dropdown_picker';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';

import { ActionKindModel, actionKinds, APLActionImplStruct, APLActionImplType, APLActionImplTypesUnion, APLActionKind } from '../model/action_kinds';
import { APLFieldDescriptor } from '../model/field_descriptors';
import * as AplHelpers from './apl_helpers';
import * as AplValues from './apl_values';
export interface APLActionPickerConfig extends InputConfig<Player<any>, APLAction> {}

export type { APLActionImplType, APLActionKind };

export class APLActionPicker extends Input<Player<any>, APLAction> {
	private kindPicker: TextDropdownPicker<Player<any>, APLActionKind>;

	private readonly actionDiv: HTMLElement;
	private currentKind: APLActionKind;
	private actionPicker: Input<Player<any>, any> | null;

	private readonly conditionPicker: AplValues.APLValuePicker;

	constructor(parent: HTMLElement, player: Player<any>, config: APLActionPickerConfig) {
		super(parent, 'apl-action-picker-root', player, config);

		this.conditionPicker = new AplValues.APLValuePicker(this.rootElem, this.modObject, {
			label: i18n.t('rotation_tab.apl.priority_list.if_label'),
			getValue: (_player: Player<any>) => this.getSourceValue()?.condition,
			setValue: (player: Player<any>, newValue: APLValue | undefined) => {
				const srcVal = this.getSourceValue();
				if (srcVal) {
					srcVal.condition = newValue;
					player.touchRotation();
				} else {
					this.setSourceValue(
						APLAction.create({
							condition: newValue,
						}),
					);
				}
			},
		});
		this.conditionPicker.rootElem.classList.add('apl-action-condition', 'apl-priority-list-only');

		this.actionDiv = document.createElement('div');
		this.actionDiv.classList.add('apl-action-picker-action');
		this.rootElem.appendChild(this.actionDiv);

		const isPrepull = this.rootElem.closest('.apl-prepull-action-picker') != null;

		const allActionKinds = (Object.keys(actionKindFactories) as Array<NonNullable<APLActionKind>>).filter(
			actionKind => actionKindFactories[actionKind].includeIf?.(player, isPrepull) ?? true,
		);

		this.kindPicker = new TextDropdownPicker(this.actionDiv, player, {
			id: randomUUID(),
			defaultLabel: i18n.t('rotation_tab.apl.priority_list.item_label'),
			values: allActionKinds.map(actionKind => {
				const factory = actionKindFactories[actionKind];
				return {
					value: actionKind,
					label: factory.label,
					submenu: factory.submenu,
					tooltip: factory.fullDescription ? `<p>${factory.shortDescription}</p> ${factory.fullDescription}` : factory.shortDescription,
				};
			}),
			equals: (a, b) => a == b,
			getValue: (_player: Player<any>) => this.getSourceValue()?.action.oneofKind,
			setValue: (player: Player<any>, newKind: APLActionKind) => {
				const sourceValue = this.getSourceValue();
				const oldKind = sourceValue?.action.oneofKind;
				if (oldKind == newKind) {
					return;
				}

				if (newKind) {
					const factory = actionKindFactories[newKind];
					let newSourceValue = this.makeAPLAction(newKind, factory.newValue());
					if (sourceValue) {
						// Some pre-fill logic when swapping kinds.
						if (oldKind && this.actionPicker) {
							if (newKind == 'sequence') {
								if (sourceValue.action.oneofKind == 'strictSequence') {
									(newSourceValue.action as APLActionImplStruct<'sequence'>).sequence.actions = sourceValue.action.strictSequence.actions;
								} else {
									(newSourceValue.action as APLActionImplStruct<'sequence'>).sequence.actions = [
										this.makeAPLAction(oldKind, this.actionPicker.getInputValue()),
									];
								}
							} else if (newKind == 'strictSequence') {
								if (sourceValue.action.oneofKind == 'sequence') {
									(newSourceValue.action as APLActionImplStruct<'strictSequence'>).strictSequence.actions =
										sourceValue.action.sequence.actions;
								} else {
									(newSourceValue.action as APLActionImplStruct<'strictSequence'>).strictSequence.actions = [
										this.makeAPLAction(oldKind, this.actionPicker.getInputValue()),
									];
								}
							} else if (sourceValue.action.oneofKind == 'sequence' && sourceValue.action.sequence.actions?.[0]?.action.oneofKind == newKind) {
								newSourceValue = sourceValue.action.sequence.actions[0];
							} else if (
								sourceValue.action.oneofKind == 'strictSequence' &&
								sourceValue.action.strictSequence.actions?.[0]?.action.oneofKind == newKind
							) {
								newSourceValue = sourceValue.action.strictSequence.actions[0];
							}
						}
					}
					if (sourceValue) {
						sourceValue.action = newSourceValue.action;
					} else {
						this.setSourceValue(newSourceValue);
					}
				} else {
					sourceValue.action = {
						oneofKind: newKind,
					};
				}
				player.touchRotation();
			},
		});

		this.currentKind = undefined;
		this.actionPicker = null;

		this.addChild(this.conditionPicker);
		this.addChild(this.kindPicker);
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLAction {
		const actionKind = this.kindPicker.getInputValue();
		return APLAction.create({
			condition: this.conditionPicker.getInputValue(),
			action: {
				oneofKind: actionKind,
				...(() => {
					const val: any = {};
					if (actionKind && this.actionPicker) {
						val[actionKind] = this.actionPicker.getInputValue();
					}
					return val;
				})(),
			},
		});
	}

	setInputValue(newValue: APLAction) {
		if (!newValue) {
			return;
		}

		this.conditionPicker.setInputValue(
			newValue.condition ||
				APLValue.create({
					uuid: { value: randomUUID() },
				}),
		);

		const newActionKind = newValue.action.oneofKind;
		this.updateActionPicker(newActionKind);

		if (newActionKind) {
			this.actionPicker!.setInputValue((newValue.action as any)[newActionKind]);
		}
	}

	private makeAPLAction<K extends NonNullable<APLActionKind>>(kind: K, implVal: APLActionImplTypesUnion[K]): APLAction {
		if (!kind) {
			return APLAction.create();
		}
		const obj: any = { oneofKind: kind };
		obj[kind] = implVal;
		return APLAction.create({ action: obj });
	}

	private updateActionPicker(newActionKind: APLActionKind) {
		const actionKind = this.currentKind;
		if (newActionKind == actionKind) {
			return;
		}
		this.currentKind = newActionKind;
		this.kindPicker.setInputValue(newActionKind);

		if (this.actionPicker) {
			this.removeChild(this.actionPicker);
			this.actionPicker = null;
		}

		if (!newActionKind) {
			return;
		}

		const factory = actionKindFactories[newActionKind];
		this.actionPicker = factory.factory(this.actionDiv, this.modObject, {
			getValue: () => (this.getSourceValue()?.action as any)?.[newActionKind] || factory.newValue(),
			setValue: (player: Player<any>, newValue: any) => {
				const sourceValue = this.getSourceValue();
				if (sourceValue) {
					(sourceValue?.action as any)[newActionKind] = newValue;
				}
				player.touchRotation();
			},
		});
		this.addChild(this.actionPicker);
		this.actionPicker.rootElem.classList.add('apl-action-' + newActionKind);
	}
}

type ActionKindConfig<T> = ActionKindModel<T> & {
	factory: (parent: HTMLElement, player: Player<any>, config: InputConfig<Player<any>, T>) => Input<Player<any>, T>;
};

function actionFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () =>
			APLValue.create({
				uuid: { value: randomUUID() },
			}),
		factory: (parent, player, config) => new APLActionPicker(parent, player, config),
	};
}

function actionListFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => [],
		factory: (parent, player, config) =>
			new ListPicker<Player<any>, APLAction>(parent, player, {
				...config,
				// Override setValue to replace undefined elements with default messages.
				setValue: (player: Player<any>, newValue: Array<APLAction>) => {
					config.setValue(
						player,
						newValue.map(val => val || APLAction.create()),
					);
				},
				itemLabel: 'action',
				newItem: APLAction.create,
				copyItem: (oldValue: APLAction) => (oldValue ? APLAction.clone(oldValue) : oldValue),
				newItemPicker: (
					parent: HTMLElement,
					listPicker: ListPicker<Player<any>, APLAction>,
					index: number,
					config: ListItemPickerConfig<Player<any>, APLAction>,
				) => new APLActionPicker(parent, player, config),
				allowedActions: ['create', 'delete', 'move'],
				actions: {
					create: {
						useIcon: true,
					},
				},
			}),
	};
}

/** Maps a DOM-free field descriptor from `model/` onto the picker factory that builds it. */
function makeFieldConfig(descriptor: APLFieldDescriptor): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	switch (descriptor.type) {
		case 'action':
			return actionFieldConfig(descriptor.field);
		case 'actionList':
			return actionListFieldConfig(descriptor.field);
		default:
			return AplValues.makeFieldConfig(descriptor);
	}
}

// The kind table itself lives in `model/action_kinds.ts` (label/submenu/descriptions/
// includeIf/newValue + DOM-free field descriptors). Here each entry gains the picker
// `factory` built from those descriptors. `Object.keys` preserves insertion order, which
// is the order the kind dropdown lists them in.
const actionKindFactories = Object.fromEntries(
	(Object.keys(actionKinds) as Array<NonNullable<APLActionKind>>).map(kind => {
		const kindModel: ActionKindModel<any> = actionKinds[kind];
		return [kind, { ...kindModel, factory: AplHelpers.aplInputBuilder(kindModel.newValue, kindModel.fields.map(makeFieldConfig)) }];
	}),
) as { [f in NonNullable<APLActionKind>]: ActionKindConfig<APLActionImplTypesUnion[f]> };
