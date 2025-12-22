import { Player } from '../../player.js';
import { itemSwapEnabledSpecs } from '../../individual_sim_ui.js';
import {
	APLValue,
	APLValueAllTrinketStatProcsActive,
	APLValueAnyTrinketStatProcsAvailable,
	APLValueAnd,
	APLValueAnyStatBuffCooldownsActive,
	APLValueAnyStatBuffCooldownsMinDuration,
	APLValueAnyTrinketStatProcsActive,
	APLValueAuraInternalCooldown,
	APLValueAuraIsActive,
	APLValueAuraIsKnown,
	APLValueAuraNumStacks,
	APLValueAuraRemainingTime,
	APLValueAuraShouldRefresh,
	APLValueAutoTimeToNext,
	APLValueBossSpellIsCasting,
	APLValueBossSpellTimeToReady,
	APLValueCatExcessEnergy,
	APLValueCatNewSavageRoarDuration,
	APLValueChannelClipDelay,
	APLValueCompare,
	APLValueCompare_ComparisonOperator as ComparisonOperator,
	APLValueConst,
	APLValueCurrentComboPoints,
	APLValueCurrentEclipsePhase,
	APLValueCurrentEnergy,
	APLValueCurrentFocus,
	APLValueCurrentGenericResource,
	APLValueCurrentHealth,
	APLValueCurrentHealthPercent,
	APLValueCurrentLunarEnergy,
	APLValueCurrentMana,
	APLValueCurrentManaPercent,
	APLValueCurrentNonDeathRuneCount,
	APLValueCurrentRage,
	APLValueCurrentRuneActive,
	APLValueCurrentRuneCount,
	APLValueCurrentRuneDeath,
	APLValueCurrentRunicPower,
	APLValueCurrentSolarEnergy,
	APLValueCurrentTime,
	APLValueCurrentTimePercent,
	APLValueDotIsActive,
	APLValueDotIsActiveOnAllTargets,
	APLValueDotLowestRemainingTime,
	APLValueDotPercentIncrease,
	APLValueDotRemainingTime,
	APLValueDotTickFrequency,
	APLValueAfflictionCurrentSnapshot,
	APLValueEnergyRegenPerSecond,
	APLValueEnergyTimeToTarget,
	APLValueFocusRegenPerSecond,
	APLValueFocusTimeToTarget,
	APLValueFrontOfTarget,
	APLValueGCDIsReady,
	APLValueGCDTimeToReady,
	APLValueInputDelay,
	APLValueIsExecutePhase,
	APLValueIsExecutePhase_ExecutePhaseThreshold as ExecutePhaseThreshold,
	APLValueMageCurrentCombustionDotEstimate,
	APLValueMath,
	APLValueMath_MathOperator as MathOperator,
	APLValueMax,
	APLValueMaxComboPoints,
	APLValueMaxEnergy,
	APLValueMaxFocus,
	APLValueMaxHealth,
	APLValueMaxRage,
	APLValueMaxRunicPower,
	APLValueMin,
	APLValueMonkCurrentChi,
	APLValueMonkMaxChi,
	APLValueNextRuneCooldown,
	APLValueFullRuneCooldown,
	APLValueNot,
	APLValueNumberTargets,
	APLValueNumEquippedStatProcTrinkets,
	APLValueNumStatBuffCooldowns,
	APLValueOr,
	APLValueProtectionPaladinDamageTakenLastGlobal,
	APLValueRemainingTime,
	APLValueRemainingTimePercent,
	APLValueRuneCooldown,
	APLValueRuneSlotCooldown,
	APLValueSequenceIsComplete,
	APLValueSequenceIsReady,
	APLValueSequenceTimeToReady,
	APLValueShamanFireElementalDuration,
	APLValueSpellCanCast,
	APLValueSpellCastTime,
	APLValueSpellChanneledTicks,
	APLValueSpellCPM,
	APLValueSpellCurrentCost,
	APLValueSpellIsChanneling,
	APLValueSpellIsKnown,
	APLValueSpellIsReady,
	APLValueSpellNumCharges,
	APLValueSpellTimeToCharge,
	APLValueSpellTimeToReady,
	APLValueSpellTravelTime,
	APLValueTotemRemainingTime,
	APLValueTrinketProcsMaxRemainingICD,
	APLValueTrinketProcsMinRemainingTime,
	APLValueUnitDistance,
	APLValueUnitIsMoving,
	APLValueVariablePlaceholder,
	APLValueWarlockHandOfGuldanInFlight,
	APLValueWarlockHauntInFlight,
	APLValueAfflictionExhaleWindow,
	APLValueAuraIsInactive,
	APLValueAuraICDIsReady,
	APLValueActiveItemSwapSet,
	APLValueDotBaseDuration,
	APLValueSpellGCDHastedDuration,
	APLValueSpellFullCooldown,
	APLValueDotTimeToNextTick,
	APLValueSpellInFlight,
	APLValueBossCurrentTarget,
	APLValueSpellIsCasting,
	APLValueRemainingCastTime,
} from '../../proto/apl.js';
import { Class, Spec } from '../../proto/common.js';
import { ShamanTotems_TotemType as TotemType } from '../../proto/shaman.js';
import SecondaryResource from '../../proto_utils/secondary_resource';
import { EventID } from '../../typed_event.js';
import { randomUUID } from '../../utils';
import { Input, InputConfig } from '../input.js';
import { TextDropdownPicker, TextDropdownValueConfig } from '../pickers/dropdown_picker.jsx';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker.jsx';
import i18n from '../../../i18n/config';
import * as AplHelpers from './apl_helpers.js';

export interface APLValuePickerConfig extends InputConfig<Player<any>, APLValue | undefined> {}

type APLValue_Value = APLValue['value'];
export type APLValueKind = APLValue_Value['oneofKind'];
type ValidAPLValueKind = NonNullable<APLValueKind>;

export type APLValueImplStruct<F extends APLValueKind> = Extract<APLValue_Value, { oneofKind: F }>;

// Get the implementation type for a specific kind using infer
type APLValueImplFor<F extends ValidAPLValueKind> = APLValueImplStruct<F> extends { [K in F]: infer T } ? T : never;

// Map all valid kinds to their implementation types
type APLValueImplMap = {
	[K in ValidAPLValueKind]: APLValueImplFor<K>;
};

export type APLValueImplType = APLValueImplMap[ValidAPLValueKind] | undefined;

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
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
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
				player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.currentKind = undefined;
		this.valuePicker = null;

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
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => {
				const sourceVal = this.getSourceValue();
				return sourceVal ? (sourceVal.value as any)[newKind] || factory.newValue() : factory.newValue();
			},
			setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
				const sourceVal = this.getSourceValue();
				if (sourceVal) {
					(sourceVal.value as any)[newKind] = newValue;
				}
				player.rotationChangeEmitter.emit(eventID);
			},
		});
	}
}

type ValueKindConfig<T> = {
	label: string;
	submenu?: Array<string>;
	shortDescription: string;
	fullDescription?: string;
	newValue: () => T;
	includeIf?: (player: Player<any>, isPrepull: boolean, isGroup: boolean) => boolean;
	factory: (parent: HTMLElement, player: Player<any>, config: InputConfig<Player<any>, T>) => Input<Player<any>, T>;
	dynamicStringResolver?: (value: string, player: Player<any>) => string;
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
					parent: HTMLElement,
					listPicker: ListPicker<Player<any>, APLValue | undefined>,
					index: number,
					config: ListItemPickerConfig<Player<any>, APLValue | undefined>,
				) => new APLValuePicker(parent, player, config),
				allowedActions: ['copy', 'create', 'delete', 'move'],
				actions: {
					create: {
						useIcon: true,
					},
				},
			}),
	};
}

function inputBuilder<T extends APLValueImplType>(
	config: {
		fields: Array<AplHelpers.APLPickerBuilderFieldConfig<T, keyof T>>;
	} & Omit<ValueKindConfig<T>, 'factory'>,
): ValueKindConfig<T> {
	return {
		label: config.label,
		submenu: config.submenu,
		shortDescription: config.shortDescription,
		fullDescription: config.fullDescription,
		newValue: config.newValue,
		includeIf: config.includeIf,
		factory: AplHelpers.aplInputBuilder(config.newValue, config.fields),
		dynamicStringResolver: config.dynamicStringResolver,
	};
}

const valueKindFactories: { [f in ValidAPLValueKind]: ValueKindConfig<APLValueImplMap[f]> } = {
	// Operators
	const: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.const.label'),
		shortDescription: i18n.t('rotation_tab.apl.values.const.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.const.full_description'),
		newValue: APLValueConst.create,
		fields: [AplHelpers.stringFieldConfig('val')],
	}),
	cmp: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.compare.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.compare.tooltip'),
		newValue: APLValueCompare.create,
		fields: [valueFieldConfig('lhs'), comparisonOperatorFieldConfig('op'), valueFieldConfig('rhs')],
	}),
	math: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.math.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.math.tooltip'),
		newValue: APLValueMath.create,
		fields: [valueFieldConfig('lhs'), mathOperatorFieldConfig('op'), valueFieldConfig('rhs')],
	}),
	max: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.max.tooltip'),
		newValue: APLValueMax.create,
		fields: [valueListFieldConfig('vals')],
	}),
	min: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.min.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.min.tooltip'),
		newValue: APLValueMin.create,
		fields: [valueListFieldConfig('vals')],
	}),
	and: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.all_of.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.all_of.tooltip'),
		newValue: APLValueAnd.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [valueListFieldConfig('vals')],
	}),
	or: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.any_of.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.any_of.tooltip'),
		newValue: APLValueOr.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [valueListFieldConfig('vals')],
	}),
	not: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.not.label'),
		submenu: ['logic'],
		shortDescription: i18n.t('rotation_tab.apl.values.not.tooltip'),
		newValue: APLValueNot.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [valueFieldConfig('val')],
	}),

	// Encounter
	currentTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_time.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_time.tooltip'),
		newValue: APLValueCurrentTime.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	currentTimePercent: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_time_percent.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_time_percent.tooltip'),
		newValue: APLValueCurrentTimePercent.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	remainingTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.remaining_time.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.remaining_time.tooltip'),
		newValue: APLValueRemainingTime.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	remainingTimePercent: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.remaining_time_percent.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.remaining_time_percent.tooltip'),
		newValue: APLValueRemainingTimePercent.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	isExecutePhase: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.is_execute_phase.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.is_execute_phase.tooltip'),
		newValue: APLValueIsExecutePhase.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [executePhaseThresholdFieldConfig('threshold')],
	}),
	numberTargets: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.num_targets.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.num_targets.tooltip'),
		newValue: APLValueNumberTargets.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	frontOfTarget: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.in_front_of_target.label'),
		submenu: ['encounter'],
		shortDescription: i18n.t('rotation_tab.apl.values.in_front_of_target.tooltip'),
		newValue: APLValueFrontOfTarget.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),

	// Boss
	bossSpellIsCasting: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.spell_is_casting.label'),
		submenu: ['boss'],
		shortDescription: i18n.t('rotation_tab.apl.values.spell_is_casting.tooltip'),
		newValue: APLValueBossSpellIsCasting.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('targetUnit', 'targets'),
			AplHelpers.actionIdFieldConfig('spellId', 'non_instant_spells', 'targetUnit', 'currentTarget'),
		],
	}),
	bossSpellTimeToReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.spell_time_to_ready.label'),
		submenu: ['boss'],
		shortDescription: i18n.t('rotation_tab.apl.values.spell_time_to_ready.tooltip'),
		newValue: APLValueBossSpellTimeToReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets'), AplHelpers.actionIdFieldConfig('spellId', 'spells', 'targetUnit', 'currentTarget')],
	}),
	bossCurrentTarget: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.boss_current_target.label'),
		submenu: ['boss'],
		shortDescription: i18n.t('rotation_tab.apl.values.boss_current_target.tooltip'),
		newValue: APLValueBossCurrentTarget.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets')],
	}),

	// Unit
	unitIsMoving: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.unit_is_moving.label'),
		submenu: ['unit'],
		shortDescription: i18n.t('rotation_tab.apl.values.unit_is_moving.tooltip'),
		newValue: APLValueUnitIsMoving.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources')],
	}),
	unitDistance: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.distance_to_unit.label'),
		submenu: ['unit'],
		shortDescription: i18n.t('rotation_tab.apl.values.distance_to_unit.tooltip'),
		newValue: APLValueUnitDistance.create,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources')],
	}),

	// Resources
	currentHealth: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_health.label'),
		submenu: ['resources', 'health'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_health.tooltip'),
		newValue: APLValueCurrentHealth.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources')],
	}),
	currentHealthPercent: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_health_percent.label'),
		submenu: ['resources', 'health'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_health_percent.tooltip'),
		newValue: APLValueCurrentHealthPercent.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources')],
	}),
	maxHealth: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_health.label'),
		submenu: ['resources', 'health'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_health.tooltip'),
		newValue: APLValueMaxHealth.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	currentMana: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_mana.label'),
		submenu: ['resources', 'mana'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_mana.tooltip'),
		newValue: APLValueCurrentMana.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			return !isPrepull && clss !== Class.ClassDeathKnight && clss !== Class.ClassHunter && clss !== Class.ClassRogue && clss !== Class.ClassWarrior;
		},
		fields: [],
	}),
	currentManaPercent: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_mana_percent.label'),
		submenu: ['resources', 'mana'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_mana_percent.tooltip'),
		newValue: APLValueCurrentManaPercent.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			return !isPrepull && clss !== Class.ClassDeathKnight && clss !== Class.ClassHunter && clss !== Class.ClassRogue && clss !== Class.ClassWarrior;
		},
		fields: [],
	}),
	currentRage: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_rage.label'),
		submenu: ['resources', 'rage'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_rage.tooltip'),
		newValue: APLValueCurrentRage.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassWarrior);
		},
		fields: [],
	}),
	maxRage: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_rage.label'),
		submenu: ['resources', 'rage'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_rage.tooltip'),
		newValue: APLValueMaxRage.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassWarrior);
		},
		fields: [],
	}),
	currentFocus: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_focus.label'),
		submenu: ['resources', 'focus'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_focus.tooltip'),
		newValue: APLValueCurrentFocus.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassHunter,
		fields: [],
	}),
	maxFocus: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_focus.label'),
		submenu: ['resources', 'focus'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_focus.tooltip'),
		newValue: APLValueMaxFocus.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassHunter,
		fields: [],
	}),
	focusRegenPerSecond: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.focus_regen_per_second.label'),
		submenu: ['resources', 'focus'],
		shortDescription: i18n.t('rotation_tab.apl.values.focus_regen_per_second.tooltip'),
		newValue: APLValueFocusRegenPerSecond.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassHunter,
		fields: [],
	}),
	focusTimeToTarget: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.estimated_time_to_target_focus.label'),
		submenu: ['resources', 'focus'],
		shortDescription: i18n.t('rotation_tab.apl.values.estimated_time_to_target_focus.tooltip'),
		newValue: APLValueFocusTimeToTarget.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassHunter,
		fields: [valueFieldConfig('targetFocus')],
	}),
	currentEnergy: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_energy.label'),
		submenu: ['resources', 'energy'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_energy.tooltip'),
		newValue: APLValueCurrentEnergy.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassRogue || clss === Class.ClassMonk);
		},
		fields: [],
	}),
	maxEnergy: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_energy.label'),
		submenu: ['resources', 'energy'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_energy.tooltip'),
		newValue: APLValueMaxEnergy.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassRogue || clss === Class.ClassMonk);
		},
		fields: [],
	}),
	energyRegenPerSecond: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.energy_regen_per_second.label'),
		submenu: ['resources', 'energy'],
		shortDescription: i18n.t('rotation_tab.apl.values.energy_regen_per_second.tooltip'),
		newValue: APLValueEnergyRegenPerSecond.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassRogue || clss === Class.ClassMonk);
		},
		fields: [],
	}),
	energyTimeToTarget: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.estimated_time_to_target_energy.label'),
		submenu: ['resources', 'energy'],
		shortDescription: i18n.t('rotation_tab.apl.values.estimated_time_to_target_energy.tooltip'),
		newValue: APLValueEnergyTimeToTarget.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassRogue || clss === Class.ClassMonk);
		},
		fields: [valueFieldConfig('targetEnergy')],
	}),
	currentComboPoints: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_combo_points.label'),
		submenu: ['resources', 'combo_points'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_combo_points.tooltip'),
		newValue: APLValueCurrentComboPoints.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassRogue);
		},
		fields: [],
	}),
	maxComboPoints: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_combo_points.label'),
		submenu: ['resources', 'combo_points'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_combo_points.tooltip'),
		newValue: APLValueMaxComboPoints.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return !isPrepull && (spec === Spec.SpecFeralDruid || spec === Spec.SpecGuardianDruid || clss === Class.ClassRogue);
		},
		fields: [],
	}),
	monkCurrentChi: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_chi.label'),
		submenu: ['resources', 'chi'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_chi.tooltip'),
		newValue: APLValueMonkCurrentChi.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() === Class.ClassMonk,
		fields: [],
	}),
	monkMaxChi: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_chi.label'),
		submenu: ['resources', 'chi'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_chi.tooltip'),
		newValue: APLValueMonkMaxChi.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() === Class.ClassMonk,
		fields: [],
	}),
	currentRunicPower: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_runic_power.label'),
		submenu: ['resources', 'runic_power'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_runic_power.tooltip'),
		newValue: APLValueCurrentRunicPower.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [],
	}),
	maxRunicPower: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.max_runic_power.label'),
		submenu: ['resources', 'runic_power'],
		shortDescription: i18n.t('rotation_tab.apl.values.max_runic_power.tooltip'),
		newValue: APLValueMaxRunicPower.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [],
	}),
	currentSolarEnergy: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.solar_energy.label'),
		submenu: ['resources', 'eclipse'],
		shortDescription: i18n.t('rotation_tab.apl.values.solar_energy.tooltip'),
		newValue: APLValueCurrentSolarEnergy.create,
		includeIf: (player: Player<any>, _isPrepull: boolean) =>  player.getSpec() == Spec.SpecBalanceDruid,
		fields: [],
	}),
	currentLunarEnergy: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.lunar_energy.label'),
		submenu: ['resources', 'eclipse'],
		shortDescription: i18n.t('rotation_tab.apl.values.lunar_energy.tooltip'),
		newValue: APLValueCurrentLunarEnergy.create,
		includeIf: (player: Player<any>, _isPrepull: boolean) =>  player.getSpec() == Spec.SpecBalanceDruid,
		fields: [],
	}),
	druidCurrentEclipsePhase: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_eclipse_phase.label'),
		submenu: ['resources', 'eclipse'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_eclipse_phase.tooltip'),
		newValue: APLValueCurrentEclipsePhase.create,
		includeIf: (player: Player<any>, _isPrepull: boolean) =>  player.getSpec() == Spec.SpecBalanceDruid,
		fields: [AplHelpers.eclipseTypeFieldConfig('eclipsePhase')],
	}),
	currentGenericResource: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.generic_resource.label'),
		submenu: ['resources'],
		shortDescription: i18n.t('rotation_tab.apl.values.generic_resource.tooltip'),
		newValue: APLValueCurrentGenericResource.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && SecondaryResource.hasSecondaryResource(player.getSpec()),
		fields: [],
		dynamicStringResolver: (value: string, player: Player<any>) => player.secondaryResource?.replaceResourceName(value) || '',
	}),

	// Resources Rune
	currentRuneCount: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.num_runes.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.num_runes.tooltip'),
		newValue: APLValueCurrentRuneCount.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeTypeFieldConfig('runeType', true)],
	}),
	currentNonDeathRuneCount: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.num_non_death_runes.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.num_non_death_runes.tooltip'),
		newValue: APLValueCurrentNonDeathRuneCount.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeTypeFieldConfig('runeType', false)],
	}),
	currentRuneActive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.rune_is_ready.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.rune_is_ready.tooltip'),
		newValue: APLValueCurrentRuneActive.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeSlotFieldConfig('runeSlot')],
	}),
	currentRuneDeath: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.rune_is_death.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.rune_is_death.tooltip'),
		newValue: APLValueCurrentRuneDeath.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeSlotFieldConfig('runeSlot')],
	}),
	runeCooldown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.rune_cooldown.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.rune_cooldown.tooltip'),
		newValue: APLValueRuneCooldown.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeTypeFieldConfig('runeType', false)],
	}),
	nextRuneCooldown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.next_rune_cooldown.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.next_rune_cooldown.tooltip'),
		newValue: APLValueNextRuneCooldown.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeTypeFieldConfig('runeType', false)],
	}),
	runeSlotCooldown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.rune_slot_cooldown.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.rune_slot_cooldown.tooltip'),
		newValue: APLValueRuneSlotCooldown.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.runeSlotFieldConfig('runeSlot')],
	}),
	fullRuneCooldown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.full_rune_cooldown.label'),
		submenu: ['resources', 'runes'],
		shortDescription: i18n.t('rotation_tab.apl.values.full_rune_cooldown.tooltip'),
		newValue: APLValueFullRuneCooldown.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassDeathKnight,
		fields: [AplHelpers.useRuneRegenBaseValueCheckbox()],
	}),

	// GCD
	gcdIsReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.gcd_is_ready.label'),
		submenu: ['gcd'],
		shortDescription: i18n.t('rotation_tab.apl.values.gcd_is_ready.tooltip'),
		newValue: APLValueGCDIsReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	gcdTimeToReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.gcd_time_to_ready.label'),
		submenu: ['gcd'],
		shortDescription: i18n.t('rotation_tab.apl.values.gcd_time_to_ready.tooltip'),
		newValue: APLValueGCDTimeToReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),

	// Auto attacks
	autoTimeToNext: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.time_to_next_auto.label'),
		submenu: ['auto'],
		shortDescription: i18n.t('rotation_tab.apl.values.time_to_next_auto.tooltip'),
		newValue: APLValueAutoTimeToNext.create,
		includeIf(player: Player<any>, isPrepull: boolean) {
			const clss = player.getClass();
			const spec = player.getSpec();
			return (
				!isPrepull &&
				clss !== Class.ClassHunter &&
				clss !== Class.ClassMage &&
				clss !== Class.ClassPriest &&
				clss !== Class.ClassWarlock &&
				spec !== Spec.SpecBalanceDruid &&
				spec !== Spec.SpecElementalShaman
			);
		},
		fields: [],
	}),

	// Casting
	remainingCastTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.remaining_cast_time.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.values.remaining_cast_time.tooltip'),
		newValue: APLValueRemainingCastTime.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),

	// Spells
	spellIsKnown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.spell_known.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.spell_known.tooltip'),
		newValue: APLValueSpellIsKnown.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellCurrentCost: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.current_cost.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.current_cost.tooltip'),
		newValue: APLValueSpellCurrentCost.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellCanCast: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.can_cast.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.can_cast.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.can_cast.full_description'),
		newValue: APLValueSpellCanCast.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellIsReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.is_ready.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.is_ready.tooltip'),
		newValue: APLValueSpellIsReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellTimeToReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.time_to_ready.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.time_to_ready.tooltip'),
		newValue: APLValueSpellTimeToReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellCastTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.cast_time.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.cast_time.tooltip'),
		newValue: APLValueSpellCastTime.create,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellTravelTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.travel_time.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.travel_time.tooltip'),
		newValue: APLValueSpellTravelTime.create,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellCpm: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.cpm.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.cpm.tooltip'),
		newValue: APLValueSpellCPM.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellIsCasting: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.is_casting.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.is_casting.tooltip'),
		newValue: APLValueSpellIsCasting.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'non_instant_spells', '')],
	}),
	spellIsChanneling: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.is_channeling.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.is_channeling.tooltip'),
		newValue: APLValueSpellIsChanneling.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'channel_spells', '')],
	}),
	spellChanneledTicks: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.channeled_ticks.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.channeled_ticks.tooltip'),
		newValue: APLValueSpellChanneledTicks.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'channel_spells', '')],
	}),
	spellNumCharges: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.number_of_charges.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.number_of_charges.tooltip'),
		newValue: APLValueSpellNumCharges.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellTimeToCharge: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.time_to_next_charge.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.time_to_next_charge.tooltip'),
		newValue: APLValueSpellTimeToCharge.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellGcdHastedDuration: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.gcd_hasted_duration.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.gcd_hasted_duration.tooltip'),
		newValue: APLValueSpellGCDHastedDuration.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	spellFullCooldown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.full_cooldown.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.full_cooldown.tooltip'),
		newValue: APLValueSpellFullCooldown.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', '')],
	}),
	channelClipDelay: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.channel_clip_delay.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.channel_clip_delay.tooltip'),
		newValue: APLValueChannelClipDelay.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [],
	}),
	inputDelay: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.input_delay.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.input_delay.tooltip'),
		newValue: APLValueInputDelay.create,
		fields: [],
	}),
	spellInFlight: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.spell_in_flight.label'),
		submenu: ['spell'],
		shortDescription: i18n.t('rotation_tab.apl.values.spell_in_flight.tooltip'),
		newValue: APLValueSpellInFlight.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'spells_with_travelTime', '')],
	}),

	// Auras
	auraIsKnown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_known.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_known.tooltip'),
		newValue: APLValueAuraIsKnown.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'), AplHelpers.actionIdFieldConfig('auraId', 'auras', 'sourceUnit')],
	}),
	auraIsActive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_active.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_active.tooltip'),
		newValue: () => APLValueAuraIsActive.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'),
			AplHelpers.actionIdFieldConfig('auraId', 'auras', 'sourceUnit'),
			AplHelpers.reactionTimeCheckbox(),
		],
	}),
	auraIsActiveWithReactionTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_active_with_reaction_time.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_active_with_reaction_time.tooltip'),
		newValue: () => APLValueAuraIsActive.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'), AplHelpers.actionIdFieldConfig('auraId', 'auras', 'sourceUnit')],
	}),
	auraIsInactive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_inactive.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_inactive.tooltip'),
		newValue: () => APLValueAuraIsInactive.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'),
			AplHelpers.actionIdFieldConfig('auraId', 'auras', 'sourceUnit'),
			AplHelpers.reactionTimeCheckbox(),
		],
	}),
	auraIsInactiveWithReactionTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_inactive_with_reaction_time.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_inactive_with_reaction_time.tooltip'),
		newValue: () => APLValueAuraIsInactive.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'), AplHelpers.actionIdFieldConfig('auraId', 'auras', 'sourceUnit')],
	}),
	auraRemainingTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_remaining_time.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_remaining_time.tooltip'),
		newValue: APLValueAuraRemainingTime.create,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'), AplHelpers.actionIdFieldConfig('auraId', 'auras', 'sourceUnit')],
	}),
	auraNumStacks: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_num_stacks.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_num_stacks.tooltip'),
		newValue: () => APLValueAuraNumStacks.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'),
			AplHelpers.actionIdFieldConfig('auraId', 'stackable_auras', 'sourceUnit'),
			AplHelpers.reactionTimeCheckbox(),
		],
	}),
	auraInternalCooldown: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_remaining_icd.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_remaining_icd.tooltip'),
		newValue: APLValueAuraInternalCooldown.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'), AplHelpers.actionIdFieldConfig('auraId', 'icd_auras', 'sourceUnit')],
	}),
	auraIcdIsReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_icd_is_ready.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_icd_is_ready.tooltip'),
		newValue: () => APLValueAuraICDIsReady.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'),
			AplHelpers.actionIdFieldConfig('auraId', 'icd_auras', 'sourceUnit'),
			AplHelpers.reactionTimeCheckbox(),
		],
	}),
	auraIcdIsReadyWithReactionTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_icd_is_ready_with_reaction_time.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_icd_is_ready_with_reaction_time.tooltip'),
		newValue: () => APLValueAuraICDIsReady.create({ includeReactionTime: true }),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources'), AplHelpers.actionIdFieldConfig('auraId', 'icd_auras', 'sourceUnit')],
	}),
	auraShouldRefresh: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.aura_should_refresh.label'),
		submenu: ['aura'],
		shortDescription: i18n.t('rotation_tab.apl.values.aura_should_refresh.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.aura_should_refresh.full_description'),
		newValue: () =>
			APLValueAuraShouldRefresh.create({
				maxOverlap: {
					value: {
						oneofKind: 'const',
						const: {
							val: '0ms',
						},
					},
				},
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('sourceUnit', 'aura_sources_targets_first'),
			AplHelpers.actionIdFieldConfig('auraId', 'exclusive_effect_auras', 'sourceUnit', 'currentTarget'),
			valueFieldConfig('maxOverlap', {
				label: i18n.t('rotation_tab.apl.values.overlap.label'),
				labelTooltip: i18n.t('rotation_tab.apl.values.overlap.tooltip'),
			}),
		],
	}),

	// Aura Sets
	allTrinketStatProcsActive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.all_trinket_stat_procs_active.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.all_trinket_stat_procs_active.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.all_trinket_stat_procs_active.full_description'),
		newValue: () =>
			APLValueAllTrinketStatProcsActive.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
			AplHelpers.minIcdInput,
		],
	}),
	anyTrinketStatProcsActive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.any_trinket_stat_procs_active.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.any_trinket_stat_procs_active.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.any_trinket_stat_procs_active.full_description'),
		newValue: () =>
			APLValueAnyTrinketStatProcsActive.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
			AplHelpers.minIcdInput,
		],
	}),
	anyTrinketStatProcsAvailable: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.any_trinket_stat_procs_available.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.any_trinket_stat_procs_available.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.any_trinket_stat_procs_available.full_description'),
		newValue: () =>
			APLValueAnyTrinketStatProcsAvailable.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
			AplHelpers.minIcdInput,
		],
	}),
	trinketProcsMinRemainingTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.trinket_procs_min_remaining_time.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.trinket_procs_min_remaining_time.tooltip'),
		newValue: () =>
			APLValueTrinketProcsMinRemainingTime.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
			AplHelpers.minIcdInput,
		],
	}),
	trinketProcsMaxRemainingIcd: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.trinket_procs_max_remaining_icd.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.trinket_procs_max_remaining_icd.tooltip'),
		newValue: () =>
			APLValueTrinketProcsMaxRemainingICD.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
			AplHelpers.minIcdInput,
		],
	}),
	numEquippedStatProcTrinkets: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.num_equipped_stat_proc_trinkets.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.num_equipped_stat_proc_trinkets.tooltip'),
		newValue: () =>
			APLValueNumEquippedStatProcTrinkets.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
			AplHelpers.minIcdInput,
		],
	}),
	numStatBuffCooldowns: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.num_stat_buff_cooldowns.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.num_stat_buff_cooldowns.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.num_stat_buff_cooldowns.full_description'),
		newValue: () =>
			APLValueNumStatBuffCooldowns.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.statTypeFieldConfig('statType1'), AplHelpers.statTypeFieldConfig('statType2'), AplHelpers.statTypeFieldConfig('statType3')],
	}),
	anyStatBuffCooldownsActive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.any_stat_buff_cooldowns_active.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.any_stat_buff_cooldowns_active.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.any_stat_buff_cooldowns_active.full_description'),
		newValue: () =>
			APLValueAnyStatBuffCooldownsActive.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.statTypeFieldConfig('statType1'), AplHelpers.statTypeFieldConfig('statType2'), AplHelpers.statTypeFieldConfig('statType3')],
	}),
	anyStatBuffCooldownsMinDuration: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.any_stat_buff_cooldowns_min_duration.label'),
		submenu: ['aura_sets'],
		shortDescription: i18n.t('rotation_tab.apl.values.any_stat_buff_cooldowns_min_duration.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.values.any_stat_buff_cooldowns_min_duration.full_description'),
		newValue: () =>
			APLValueAnyStatBuffCooldownsMinDuration.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.statTypeFieldConfig('statType1'), AplHelpers.statTypeFieldConfig('statType2'), AplHelpers.statTypeFieldConfig('statType3')],
	}),

	// DoT
	dotIsActive: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_is_active.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_is_active.tooltip'),
		newValue: APLValueDotIsActive.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets'), AplHelpers.actionIdFieldConfig('spellId', 'dot_spells', '')],
	}),
	dotIsActiveOnAllTargets: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_is_active_on_all_targets.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_is_active_on_all_targets.tooltip'),
		newValue: APLValueDotIsActiveOnAllTargets.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'dot_spells')],
	}),
	dotRemainingTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_remaining_time.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_remaining_time.tooltip'),
		newValue: APLValueDotRemainingTime.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets'), AplHelpers.actionIdFieldConfig('spellId', 'dot_spells', '')],
	}),
	dotLowestRemainingTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_lowest_remaining_time.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_lowest_remaining_time.tooltip'),
		newValue: APLValueDotLowestRemainingTime.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'dot_spells', '')],
	}),
	dotTickFrequency: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_tick_frequency.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_tick_frequency.tooltip'),
		newValue: APLValueDotTickFrequency.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets'), AplHelpers.actionIdFieldConfig('spellId', 'dot_spells', '')],
	}),
	dotTimeToNextTick: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_time_to_next_tick.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_time_to_next_tick.tooltip'),
		newValue: APLValueDotTimeToNextTick.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets'), AplHelpers.actionIdFieldConfig('spellId', 'dot_spells', '')],
	}),
	dotBaseDuration: inputBuilder({
		label: 'Dot Base Duration',
		submenu: ['dot'],
		shortDescription: 'The base duration of the DoT.',
		newValue: APLValueDotBaseDuration.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'dot_spells', '')],
	}),
	dotPercentIncrease: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.dot_percent_increase.label'),
		submenu: ['dot'],
		shortDescription: i18n.t('rotation_tab.apl.values.dot_percent_increase.tooltip'),
		newValue: APLValueDotPercentIncrease.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('targetUnit', 'targets'),
			AplHelpers.actionIdFieldConfig('spellId', 'expected_dot_spells', ''),
			AplHelpers.useDotBaseValueCheckbox(),
		],
	}),
	dotCritPercentIncrease: inputBuilder({
		label: 'Dot Crit Chance Increase %',
		submenu: ['dot'],
		shortDescription: "How much higher a new DoT's Critical Strike Chance would be compared to the old.",
		newValue: APLValueDotPercentIncrease.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('targetUnit', 'targets'),
			AplHelpers.actionIdFieldConfig('spellId', 'expected_dot_spells', ''),
			AplHelpers.useDotBaseValueCheckbox(),
		],
	}),
	dotTickRatePercentIncrease: inputBuilder({
		label: 'Dot Tick Rate Increase %',
		submenu: ['dot'],
		shortDescription: 'How much faster a new DoT would tick compared to the old.',
		newValue: APLValueDotPercentIncrease.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [
			AplHelpers.unitFieldConfig('targetUnit', 'targets'),
			AplHelpers.actionIdFieldConfig('spellId', 'expected_dot_spells', ''),
			AplHelpers.useDotBaseValueCheckbox(),
		],
	}),
	sequenceIsComplete: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.sequence_is_complete.label'),
		submenu: ['sequence'],
		shortDescription: i18n.t('rotation_tab.apl.values.sequence_is_complete.tooltip'),
		newValue: APLValueSequenceIsComplete.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.stringFieldConfig('sequenceName')],
	}),
	sequenceIsReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.sequence_is_ready.label'),
		submenu: ['sequence'],
		shortDescription: i18n.t('rotation_tab.apl.values.sequence_is_ready.tooltip'),
		newValue: APLValueSequenceIsReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.stringFieldConfig('sequenceName')],
	}),
	sequenceTimeToReady: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.sequence_time_to_ready.label'),
		submenu: ['sequence'],
		shortDescription: i18n.t('rotation_tab.apl.values.sequence_time_to_ready.tooltip'),
		newValue: APLValueSequenceTimeToReady.create,
		includeIf: (_: Player<any>, isPrepull: boolean) => !isPrepull,
		fields: [AplHelpers.stringFieldConfig('sequenceName')],
	}),

	// Class/spec specific values
	totemRemainingTime: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.totem_remaining_time.label'),
		submenu: ['shaman'],
		shortDescription: i18n.t('rotation_tab.apl.values.totem_remaining_time.tooltip'),
		newValue: APLValueTotemRemainingTime.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassShaman,
		fields: [totemTypeFieldConfig('totemType')],
	}),
	shamanFireElementalDuration: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.shaman_fire_elemental_duration.label'),
		submenu: ['shaman'],
		shortDescription: i18n.t('rotation_tab.apl.values.shaman_fire_elemental_duration.tooltip'),
		newValue: APLValueShamanFireElementalDuration.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getClass() == Class.ClassShaman,
		fields: [],
	}),
	catExcessEnergy: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.cat_excess_energy.label'),
		submenu: ['feral_druid'],
		shortDescription: i18n.t('rotation_tab.apl.values.cat_excess_energy.tooltip'),
		newValue: APLValueCatExcessEnergy.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecFeralDruid,
		fields: [],
	}),
	catNewSavageRoarDuration: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.cat_new_savage_roar_duration.label'),
		submenu: ['feral_druid'],
		shortDescription: i18n.t('rotation_tab.apl.values.cat_new_savage_roar_duration.tooltip'),
		newValue: APLValueCatNewSavageRoarDuration.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecFeralDruid,
		fields: [],
	}),
	warlockHandOfGuldanInFlight: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.warlock_hand_of_guldan_in_flight.label'),
		submenu: ['warlock'],
		shortDescription: i18n.t('rotation_tab.apl.values.warlock_hand_of_guldan_in_flight.tooltip'),
		newValue: APLValueWarlockHandOfGuldanInFlight.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecDemonologyWarlock,
		fields: [],
	}),
	warlockHauntInFlight: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.warlock_haunt_in_flight.label'),
		submenu: ['warlock'],
		shortDescription: i18n.t('rotation_tab.apl.values.warlock_haunt_in_flight.tooltip'),
		newValue: APLValueWarlockHauntInFlight.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecAfflictionWarlock,
		fields: [],
	}),
	afflictionExhaleWindow: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.affliction_exhale_window.label'),
		submenu: ['warlock'],
		shortDescription: i18n.t('rotation_tab.apl.values.affliction_exhale_window.tooltip'),
		newValue: APLValueAfflictionExhaleWindow.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecAfflictionWarlock,
		fields: [],
	}),
	afflictionCurrentSnapshot: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.affliction_current_snapshot.label'),
		submenu: ['warlock'],
		shortDescription: i18n.t('rotation_tab.apl.values.affliction_current_snapshot.tooltip'),
		newValue: APLValueAfflictionCurrentSnapshot.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecAfflictionWarlock,
		fields: [AplHelpers.unitFieldConfig('targetUnit', 'targets'), AplHelpers.actionIdFieldConfig('spellId', 'expected_dot_spells', '')],
	}),
	mageCurrentCombustionDotEstimate: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.mage_current_combustion_dot_estimate.label'),
		submenu: ['mage'],
		shortDescription: i18n.t('rotation_tab.apl.values.mage_current_combustion_dot_estimate.tooltip'),
		newValue: APLValueMageCurrentCombustionDotEstimate.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() == Spec.SpecFireMage,
		fields: [],
	}),
	brewmasterMonkCurrentStaggerPercent: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.brewmaster_monk_current_stagger_percent.label'),
		submenu: ['tank'],
		shortDescription: i18n.t('rotation_tab.apl.values.brewmaster_monk_current_stagger_percent.tooltip'),
		newValue: APLValueMonkCurrentChi.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() === Spec.SpecBrewmasterMonk,
		fields: [],
	}),
	protectionPaladinDamageTakenLastGlobal: inputBuilder({
		label: i18n.t('rotation_tab.apl.values.protection_paladin_damage_taken_last_global.label'),
		submenu: ['tank'],
		shortDescription: i18n.t('rotation_tab.apl.values.protection_paladin_damage_taken_last_global.tooltip'),
		newValue: APLValueProtectionPaladinDamageTakenLastGlobal.create,
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec() === Spec.SpecProtectionPaladin,
		fields: [],
	}),

	variableRef: inputBuilder({
		label: 'Variable Reference',
		submenu: ['Variables'],
		shortDescription: 'Reference a named condition variable',
		newValue: () => ({ name: '' }),
		fields: [AplHelpers.variableNameFieldConfig('name')],
	}),
	variablePlaceholder: inputBuilder({
		label: 'Variable Placeholder',
		submenu: ['Variables'],
		shortDescription: 'Placeholder value that gets replaced when group is referenced',
		fullDescription: `
			<p>Defines a placeholder value that must be set when this group is referenced. This allows groups to be parameterized.</p>
			<p>Example: If you add a Variable Placeholder named "replace", then when referencing this group, you must provide a value for "replace".</p>
		`,
		includeIf: (_player: Player<any>, isPrepull: boolean, isGroup: boolean) => !isPrepull && isGroup, // Only show in groups, not prepull or priority list
		newValue: () => ({ name: '' }),
		fields: [
			AplHelpers.stringFieldConfig('name', {
				labelTooltip: 'Name of the variable placeholder to expose. This name will be used when referencing the group.',
			}),
		],
	}),
	activeItemSwapSet: inputBuilder({
		label: 'Item Swap',
		submenu: ['Misc'],
		shortDescription: 'Returns <b>True</b> if the specified item swap set is currently active.',
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && itemSwapEnabledSpecs.includes(player.getSpec()),
		newValue: APLValueActiveItemSwapSet.create,
		fields: [AplHelpers.itemSwapSetFieldConfig('swapSet')],
	}),
};
