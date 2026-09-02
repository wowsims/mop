import {
	APLValue,
	APLValueCompare_ComparisonOperator as ComparisonOperator,
	APLValueIsExecutePhase_ExecutePhaseThreshold as ExecutePhaseThreshold,
	APLValueMath_MathOperator as MathOperator,
} from '@core/proto/apl';
import { ShamanTotems_TotemType as TotemType } from '@core/proto/shaman';
import { Player } from '@domain/player';
import { EventID, nextEventID } from '@domain/state/batch';
import { randomUUID } from '@domain/utils';
import i18n from '@i18n/config';
import { Input, InputConfig } from '@ui-kit/input';
import { TextDropdownPicker, TextDropdownValueConfig } from '@ui-kit/pickers/dropdown_picker';
import { ListItemPickerConfig, ListPicker } from '@ui-kit/pickers/list_picker';

import { ValueFieldDescriptor } from '../model/field_descriptors';
import { APLValueImplMap, APLValueImplStruct, APLValueImplType, APLValueKind, ValidAPLValueKind, ValueKindModel, valueKinds } from '../model/value_kinds';
import * as AplHelpers from './apl_helpers';
export interface APLValuePickerConfig extends InputConfig<Player<any>, APLValue | undefined> {}

export type { APLValueImplStruct, APLValueImplType, APLValueKind };

export class APLValuePicker extends Input<Player<any>, APLValue | undefined> {
	private kindPicker: TextDropdownPicker<Player<any>, APLValueKind>;

	private currentKind: APLValueKind;
	private valuePicker: Input<Player<any>, any> | null;

	constructor(parent: HTMLElement, player: Player<any>, config: APLValuePickerConfig) {
		super(parent, 'apl-value-picker-root', player, config);

		const isPrepull = this.rootElem.closest('.apl-prepull-action-picker') != null;
		const isGroup = this.rootElem.closest('.apl-groups-picker') != null;

		const allValueKinds = (Object.keys(valueKindFactories) as ValidAPLValueKind[]).filter(
			(valueKind): valueKind is ValidAPLValueKind => (!!valueKind && valueKindFactories[valueKind].includeIf?.(player, isPrepull, isGroup)) ?? true,
		);

		if (this.rootElem.parentElement!.classList.contains('list-picker-item')) {
			const itemHeaderElem = ListPicker.getItemHeaderElem(this) || this.rootElem;
			ListPicker.makeListItemValidations(
				itemHeaderElem,
				player,
				player => player.getCurrentStats().rotationStats?.uuidValidations?.find(v => v.uuid?.value === this.rootElem.id)?.validations || [],
			);
		}

		this.kindPicker = new TextDropdownPicker(this.rootElem, player, {
			defaultLabel: i18n.t('rotation_tab.apl.values.no_condition'),
			id: randomUUID(),
			values: [
				{
					value: undefined,
					label: i18n.t('rotation_tab.apl.values.none'),
				} as TextDropdownValueConfig<APLValueKind>,
			].concat(
				allValueKinds.map(kind => {
					const factory = valueKindFactories[kind];
					const resolveString = factory.dynamicStringResolver || ((value: string) => value);
					return {
						value: kind,
						label: resolveString(factory.label, player),
						submenu: factory.submenu,
						tooltip: factory.fullDescription
							? `<p>${resolveString(factory.shortDescription, player)}</p> ${resolveString(factory.fullDescription, player)}`
							: resolveString(factory.shortDescription, player),
					};
				}),
			),
			equals: (a, b) => a == b,
			getValue: (_player: Player<any>) => this.getSourceValue()?.value.oneofKind,
			setValue: (eventID: EventID, player: Player<any>, newKind: APLValueKind) => {
				const sourceValue = this.getSourceValue();
				const oldKind = sourceValue?.value.oneofKind;
				if (oldKind == newKind) {
					return;
				}

				if (newKind) {
					const factory = valueKindFactories[newKind];
					let newSourceValue = this.makeAPLValue(newKind, factory.newValue());
					if (sourceValue) {
						// Some pre-fill logic when swapping kinds.
						if (oldKind && this.valuePicker) {
							if (newKind == 'not') {
								(newSourceValue.value as APLValueImplStruct<'not'>).not.val = this.makeAPLValue(oldKind, this.valuePicker.getInputValue());
							} else if (sourceValue.value.oneofKind == 'not' && sourceValue.value.not.val?.value.oneofKind == newKind) {
								newSourceValue = sourceValue.value.not.val;
							} else if (newKind == 'and') {
								if (sourceValue.value.oneofKind == 'or') {
									(newSourceValue.value as APLValueImplStruct<'and'>).and.vals = sourceValue.value.or.vals;
								} else {
									(newSourceValue.value as APLValueImplStruct<'and'>).and.vals = [
										this.makeAPLValue(oldKind, this.valuePicker.getInputValue()),
									];
								}
							} else if (newKind == 'or') {
								if (sourceValue.value.oneofKind == 'and') {
									(newSourceValue.value as APLValueImplStruct<'or'>).or.vals = sourceValue.value.and.vals;
								} else {
									(newSourceValue.value as APLValueImplStruct<'or'>).or.vals = [this.makeAPLValue(oldKind, this.valuePicker.getInputValue())];
								}
							} else if (newKind == 'min') {
								if (sourceValue.value.oneofKind == 'max') {
									(newSourceValue.value as APLValueImplStruct<'min'>).min.vals = sourceValue.value.max.vals;
								} else {
									(newSourceValue.value as APLValueImplStruct<'min'>).min.vals = [
										this.makeAPLValue(oldKind, this.valuePicker.getInputValue()),
									];
								}
							} else if (newKind == 'max') {
								if (sourceValue.value.oneofKind == 'min') {
									(newSourceValue.value as APLValueImplStruct<'max'>).max.vals = sourceValue.value.min.vals;
								} else {
									(newSourceValue.value as APLValueImplStruct<'max'>).max.vals = [
										this.makeAPLValue(oldKind, this.valuePicker.getInputValue()),
									];
								}
							} else if (sourceValue.value.oneofKind == 'and' && sourceValue.value.and.vals?.[0]?.value.oneofKind == newKind) {
								newSourceValue = sourceValue.value.and.vals[0];
							} else if (sourceValue.value.oneofKind == 'or' && sourceValue.value.or.vals?.[0]?.value.oneofKind == newKind) {
								newSourceValue = sourceValue.value.or.vals[0];
							} else if (sourceValue.value.oneofKind == 'min' && sourceValue.value.min.vals?.[0]?.value.oneofKind == newKind) {
								newSourceValue = sourceValue.value.min.vals[0];
							} else if (sourceValue.value.oneofKind == 'max' && sourceValue.value.max.vals?.[0]?.value.oneofKind == newKind) {
								newSourceValue = sourceValue.value.max.vals[0];
							} else if (newKind == 'cmp') {
								(newSourceValue.value as APLValueImplStruct<'cmp'>).cmp.lhs = this.makeAPLValue(oldKind, this.valuePicker.getInputValue());
							}
						}
					}
					if (sourceValue) {
						sourceValue.value = newSourceValue.value;
					} else {
						this.setSourceValue(eventID, newSourceValue);
					}
				} else {
					this.setSourceValue(eventID, undefined);
				}
				player.touchRotation(eventID);
			},
		});

		this.currentKind = undefined;
		this.valuePicker = null;

		this.addChild(this.kindPicker);
		this.init();
	}

	getInputElem(): HTMLElement | null {
		return this.rootElem;
	}

	getInputValue(): APLValue | undefined {
		const kind = this.kindPicker.getInputValue();
		if (!kind) {
			return undefined;
		} else {
			return APLValue.create({
				value: {
					oneofKind: kind,
					...(() => {
						const val: any = {};
						if (kind && this.valuePicker) {
							val[kind] = this.valuePicker.getInputValue();
						}
						return val;
					})(),
				},
				uuid: { value: randomUUID() },
			});
		}
	}

	setInputValue(newValue: APLValue | undefined) {
		const newKind = newValue?.value.oneofKind;
		this.updateValuePicker(newKind);

		if (newKind && newValue) {
			this.valuePicker!.setInputValue((newValue.value as any)[newKind]);
		}

		if (newValue) {
			if (!newValue.uuid || newValue.uuid.value == '') {
				newValue.uuid = {
					value: randomUUID(),
				};
			}
			this.rootElem.id = newValue.uuid!.value;
		}
	}

	private makeAPLValue<K extends ValidAPLValueKind>(kind: K, implVal: APLValueImplMap[K]): APLValue {
		if (!kind) {
			return APLValue.create({
				uuid: { value: randomUUID() },
			});
		}
		const obj: any = { oneofKind: kind };
		obj[kind] = implVal;
		return APLValue.create({
			value: obj,
			uuid: { value: randomUUID() },
		});
	}

	private updateValuePicker(newKind: APLValueKind) {
		const oldKind = this.currentKind;
		if (newKind == oldKind) {
			return;
		}
		this.currentKind = newKind;

		if (this.valuePicker) {
			this.disposeChild(this.valuePicker);
			this.valuePicker.rootElem.remove();
			this.valuePicker = null;
		}

		if (!newKind) {
			return;
		}

		this.kindPicker.setInputValue(newKind);

		const factory = valueKindFactories[newKind];
		this.valuePicker = factory.factory(this.rootElem, this.modObject, {
			id: randomUUID(),
			getValue: () => {
				const sourceVal = this.getSourceValue();
				return sourceVal ? (sourceVal.value as any)[newKind] || factory.newValue() : factory.newValue();
			},
			setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
				const sourceVal = this.getSourceValue();
				if (sourceVal) {
					(sourceVal.value as any)[newKind] = newValue;
				}
				player.touchRotation(eventID);
			},
		});
		this.addChild(this.valuePicker);
	}
}

type ValueKindConfig<T> = ValueKindModel<T> & {
	factory: (parent: HTMLElement, player: Player<any>, config: InputConfig<Player<any>, T>) => Input<Player<any>, T>;
};

function comparisonOperatorFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => ComparisonOperator.OpEq,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: [
					{ value: ComparisonOperator.OpEq, label: i18n.t('rotation_tab.apl.operators.equals') },
					{ value: ComparisonOperator.OpNe, label: i18n.t('rotation_tab.apl.operators.not_equals') },
					{ value: ComparisonOperator.OpGe, label: i18n.t('rotation_tab.apl.operators.greater_than_or_equal') },
					{ value: ComparisonOperator.OpGt, label: i18n.t('rotation_tab.apl.operators.greater_than') },
					{ value: ComparisonOperator.OpLe, label: i18n.t('rotation_tab.apl.operators.less_than_or_equal') },
					{ value: ComparisonOperator.OpLt, label: i18n.t('rotation_tab.apl.operators.less_than') },
				],
			}),
	};
}

function mathOperatorFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => MathOperator.OpAdd,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: [
					{ value: MathOperator.OpAdd, label: i18n.t('rotation_tab.apl.operators.add') },
					{ value: MathOperator.OpSub, label: i18n.t('rotation_tab.apl.operators.subtract') },
					{ value: MathOperator.OpMul, label: i18n.t('rotation_tab.apl.operators.multiply') },
					{ value: MathOperator.OpDiv, label: i18n.t('rotation_tab.apl.operators.divide') },
				],
			}),
	};
}

function executePhaseThresholdFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => ExecutePhaseThreshold.E20,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: [
					{ value: ExecutePhaseThreshold.E20, label: i18n.t('rotation_tab.apl.execute_phases.e20') },
					{ value: ExecutePhaseThreshold.E25, label: i18n.t('rotation_tab.apl.execute_phases.e25') },
					{ value: ExecutePhaseThreshold.E35, label: i18n.t('rotation_tab.apl.execute_phases.e35') },
					{ value: ExecutePhaseThreshold.E45, label: i18n.t('rotation_tab.apl.execute_phases.e45') },
					{ value: ExecutePhaseThreshold.E90, label: i18n.t('rotation_tab.apl.execute_phases.e90') },
				],
			}),
	};
}

function totemTypeFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => TotemType.Water,
		factory: (parent, player, config) =>
			new TextDropdownPicker(parent, player, {
				id: randomUUID(),
				...config,
				defaultLabel: i18n.t('common.none'),
				equals: (a, b) => a == b,
				values: [
					{ value: TotemType.Earth, label: i18n.t('rotation_tab.apl.totem_types.earth') },
					{ value: TotemType.Air, label: i18n.t('rotation_tab.apl.totem_types.air') },
					{ value: TotemType.Fire, label: i18n.t('rotation_tab.apl.totem_types.fire') },
					{ value: TotemType.Water, label: i18n.t('rotation_tab.apl.totem_types.water') },
				],
			}),
	};
}

export function valueFieldConfig(
	field: string,
	options?: Partial<AplHelpers.APLPickerBuilderFieldConfig<any, any>>,
): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () =>
			APLValue.create({
				uuid: { value: randomUUID() },
			}),
		factory: (parent, player, config) => new APLValuePicker(parent, player, config),
		...(options || {}),
	};
}

export function valueListFieldConfig(field: string): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	return {
		field: field,
		newValue: () => [],
		factory: (parent, player, config) =>
			new ListPicker<Player<any>, APLValue | undefined>(parent, player, {
				...config,
				// Override setValue to replace undefined elements with default messages.
				setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLValue | undefined>) => {
					config.setValue(
						eventID,
						player,
						newValue.map(val => {
							return (
								val ||
								APLValue.create({
									uuid: { value: randomUUID() },
								})
							);
						}),
					);
				},
				itemLabel: 'Value',
				newItem: () => {
					return APLValue.create({
						uuid: { value: randomUUID() },
					});
				},
				copyItem: (oldValue: APLValue | undefined) => (oldValue ? APLValue.clone(oldValue) : oldValue),
				newItemPicker: (
					_parent: HTMLElement,
					_listPicker: ListPicker<Player<any>, APLValue | undefined>,
					_index: number,
					config: ListItemPickerConfig<Player<any>, APLValue | undefined>,
				) => new APLValuePicker(_parent, player, config),
				allowedActions: ['copy', 'create', 'delete', 'move'],
				actions: {
					create: {
						useIcon: true,
					},
				},
				extraActions: [
					AplHelpers.extractToVariableAction(
						player,
						index => (config.getValue(player) as Array<APLValue | undefined>)[index],
						(index, ref) => {
							const values = config.getValue(player) as Array<APLValue | undefined>;
							values[index] = ref;
							config.setValue(nextEventID(), player, values);
						},
						parent,
					),
				],
			}),
	};
}

/** Maps a DOM-free field descriptor from `model/` onto the picker factory that builds it. */
export function makeFieldConfig(descriptor: ValueFieldDescriptor): AplHelpers.APLPickerBuilderFieldConfig<any, any> {
	switch (descriptor.type) {
		case 'comparisonOperator':
			return comparisonOperatorFieldConfig(descriptor.field);
		case 'mathOperator':
			return mathOperatorFieldConfig(descriptor.field);
		case 'executePhaseThreshold':
			return executePhaseThresholdFieldConfig(descriptor.field);
		case 'totemType':
			return totemTypeFieldConfig(descriptor.field);
		case 'value':
			return valueFieldConfig(descriptor.field, descriptor.options);
		case 'valueList':
			return valueListFieldConfig(descriptor.field);
		default:
			return AplHelpers.makeCommonFieldConfig(descriptor);
	}
}

// The kind table itself lives in `model/value_kinds.ts` (label/submenu/descriptions/
// includeIf/newValue + DOM-free field descriptors). Here each entry gains the picker
// `factory` built from those descriptors. `Object.keys` preserves insertion order, which
// is the order the kind dropdown lists them in.
const valueKindFactories = Object.fromEntries(
	(Object.keys(valueKinds) as Array<ValidAPLValueKind>).map(kind => {
		const kindModel: ValueKindModel<any> = valueKinds[kind];
		return [kind, { ...kindModel, factory: AplHelpers.aplInputBuilder(kindModel.newValue, kindModel.fields.map(makeFieldConfig)) }];
	}),
) as { [f in ValidAPLValueKind]: ValueKindConfig<APLValueImplMap[f]> };
