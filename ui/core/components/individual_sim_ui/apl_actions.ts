import { itemSwapEnabledSpecs } from '../../individual_sim_ui.js';
import { Player } from '../../player.js';
import {
	APLAction,
	APLActionActivateAllStatBuffProcAuras,
	APLActionActivateAura,
	APLActionActivateAuraWithStacks,
	APLActionAutocastOtherCooldowns,
	APLActionCancelAura,
	APLActionCastAllStatBuffCooldowns,
	APLActionCastFriendlySpell,
	APLActionCastSpell,
	APLActionCatOptimalRotationAction,
	APLActionChangeTarget,
	APLActionChannelSpell,
	APLActionCustomRotation,
	APLActionGroupReference,
	APLActionGuardianHotwDpsRotation,
	APLActionGuardianHotwDpsRotation_Strategy as HotwStrategy,
	APLActionItemSwap,
	APLActionItemSwap_SwapSet as ItemSwapSet,
	APLActionMove,
	APLActionMoveDuration,
	APLActionMultidot,
	APLActionMultishield,
	APLActionResetSequence,
	APLActionSchedule,
	APLActionSequence,
	APLActionStrictMultidot,
	APLActionStrictSequence,
	APLActionTriggerICD,
	APLActionWait,
	APLActionWaitUntil,
	APLValue,
	APLActionWarlockNextExhaleTarget,
	APLActionCancelSpellCast,
} from '../../proto/apl.js';
import { Spec } from '../../proto/common.js';
import { FeralDruid_Rotation_AplType } from '../../proto/druid.js';
import { EventID } from '../../typed_event.js';
import { randomUUID } from '../../utils';
import { Input, InputConfig } from '../input.js';
import i18n from '../../../i18n/config';
import { TextDropdownPicker } from '../pickers/dropdown_picker.jsx';
import { ListItemPickerConfig, ListPicker } from '../pickers/list_picker.jsx';
import * as AplHelpers from './apl_helpers.js';
import { itemSwapSetFieldConfig } from './apl_helpers.js';
import * as AplValues from './apl_values.js';

export interface APLActionPickerConfig extends InputConfig<Player<any>, APLAction> {}

export type APLActionKind = APLAction['action']['oneofKind'];
type APLActionImplStruct<F extends APLActionKind> = Extract<APLAction['action'], { oneofKind: F }>;
type APLActionImplTypesUnion = {
	[f in NonNullable<APLActionKind>]: f extends keyof APLActionImplStruct<f> ? APLActionImplStruct<f>[f] : never;
};
export type APLActionImplType = APLActionImplTypesUnion[NonNullable<APLActionKind>] | undefined;

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
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (_player: Player<any>) => this.getSourceValue()?.condition,
			setValue: (eventID: EventID, player: Player<any>, newValue: APLValue | undefined) => {
				const srcVal = this.getSourceValue();
				if (srcVal) {
					srcVal.condition = newValue;
					player.rotationChangeEmitter.emit(eventID);
				} else {
					this.setSourceValue(
						eventID,
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
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: (_player: Player<any>) => this.getSourceValue()?.action.oneofKind,
			setValue: (eventID: EventID, player: Player<any>, newKind: APLActionKind) => {
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
						this.setSourceValue(eventID, newSourceValue);
					}
				} else {
					sourceValue.action = {
						oneofKind: newKind,
					};
				}
				player.rotationChangeEmitter.emit(eventID);
			},
		});

		this.currentKind = undefined;
		this.actionPicker = null;

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

		if (this.actionPicker) {
			this.actionPicker.rootElem.remove();
			this.actionPicker = null;
		}

		if (!newActionKind) {
			return;
		}

		this.kindPicker.setInputValue(newActionKind);

		const factory = actionKindFactories[newActionKind];
		this.actionPicker = factory.factory(this.actionDiv, this.modObject, {
			changedEvent: (player: Player<any>) => player.rotationChangeEmitter,
			getValue: () => (this.getSourceValue()?.action as any)?.[newActionKind] || factory.newValue(),
			setValue: (eventID: EventID, player: Player<any>, newValue: any) => {
				const sourceValue = this.getSourceValue();
				if (sourceValue) {
					(sourceValue?.action as any)[newActionKind] = newValue;
				}
				player.rotationChangeEmitter.emit(eventID);
			},
		});
		this.actionPicker.rootElem.classList.add('apl-action-' + newActionKind);
	}
}

type ActionKindConfig<T> = {
	label: string;
	submenu?: Array<string>;
	shortDescription: string;
	fullDescription?: string;
	includeIf?: (player: Player<any>, isPrepull: boolean) => boolean;
	newValue: () => T;
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
				setValue: (eventID: EventID, player: Player<any>, newValue: Array<APLAction>) => {
					config.setValue(
						eventID,
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

function inputBuilder<T>(config: {
	label: string;
	submenu?: Array<string>;
	shortDescription: string;
	fullDescription?: string;
	includeIf?: (player: Player<any>, isPrepull: boolean) => boolean;
	newValue: () => T;
	fields: Array<AplHelpers.APLPickerBuilderFieldConfig<T, any>>;
}): ActionKindConfig<T> {
	return {
		label: config.label,
		submenu: config.submenu,
		shortDescription: config.shortDescription,
		fullDescription: config.fullDescription,
		includeIf: config.includeIf,
		newValue: config.newValue,
		factory: AplHelpers.aplInputBuilder(config.newValue, config.fields),
	};
}

const actionKindFactories: { [f in NonNullable<APLActionKind>]: ActionKindConfig<APLActionImplTypesUnion[f]> } = {
	['castSpell']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cast.label'),
		shortDescription: i18n.t('rotation_tab.apl.actions.cast.tooltip'),
		newValue: APLActionCastSpell.create,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'castable_spells', ''), AplHelpers.unitFieldConfig('target', 'targets')],
	}),
	['cancelSpellCast']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cancel_cast.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.cancel_cast.tooltip'),
		newValue: APLActionCancelSpellCast.create,
		fields: [],
	}),
	['castFriendlySpell']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cast_at_player.label'),
		shortDescription: i18n.t('rotation_tab.apl.actions.cast_at_player.tooltip'),
		newValue: APLActionCastFriendlySpell.create,
		fields: [AplHelpers.actionIdFieldConfig('spellId', 'friendly_spells', ''), AplHelpers.unitFieldConfig('target', 'players')],
		includeIf: (player: Player<any>, _isPrepull: boolean) => player.getRaid()!.size() > 1 || player.shouldEnableTargetDummies(),
	}),
	['multidot']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.multi_dot.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.multi_dot.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: () =>
			APLActionMultidot.create({
				maxDots: 3,
				maxOverlap: {
					value: {
						oneofKind: 'const',
						const: {
							val: '0ms',
						},
					},
				},
			}),
		fields: [
			AplHelpers.actionIdFieldConfig('spellId', 'castable_dot_spells', ''),
			AplHelpers.numberFieldConfig('maxDots', false, {
				label: i18n.t('rotation_tab.apl.actions.multi_dot.max_dots.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_dot.max_dots.tooltip'),
			}),
			AplValues.valueFieldConfig('maxOverlap', {
				label: i18n.t('rotation_tab.apl.actions.multi_dot.overlap.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_dot.overlap.tooltip'),
			}),
		],
	}),
	['strictMultidot']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.strict_multi_dot.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.strict_multi_dot.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: () =>
			APLActionStrictMultidot.create({
				maxDots: 3,
				maxOverlap: {
					value: {
						oneofKind: 'const',
						const: {
							val: '0ms',
						},
					},
				},
			}),
		fields: [
			AplHelpers.actionIdFieldConfig('spellId', 'castable_dot_spells', ''),
			AplHelpers.numberFieldConfig('maxDots', false, {
				label: i18n.t('rotation_tab.apl.actions.strict_multi_dot.max_dots.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.strict_multi_dot.max_dots.tooltip'),
			}),
			AplValues.valueFieldConfig('maxOverlap', {
				label: i18n.t('rotation_tab.apl.actions.strict_multi_dot.overlap.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.strict_multi_dot.overlap.tooltip'),
			}),
		],
	}),
	['multishield']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.multi_shield.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.multi_shield.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull && player.getSpec().isHealingSpec,
		newValue: () =>
			APLActionMultishield.create({
				maxShields: 3,
				maxOverlap: {
					value: {
						oneofKind: 'const',
						const: {
							val: '0ms',
						},
					},
				},
			}),
		fields: [
			AplHelpers.actionIdFieldConfig('spellId', 'shield_spells', ''),
			AplHelpers.numberFieldConfig('maxShields', false, {
				label: i18n.t('rotation_tab.apl.actions.multi_shield.max_shields.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_shield.max_shields.tooltip'),
			}),
			AplValues.valueFieldConfig('maxOverlap', {
				label: i18n.t('rotation_tab.apl.actions.multi_shield.overlap.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_shield.overlap.tooltip'),
			}),
		],
	}),
	['channelSpell']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.channel.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.channel.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.channel.full'),
		newValue: () =>
			APLActionChannelSpell.create({
				interruptIf: {
					value: {
						oneofKind: 'gcdIsReady',
						gcdIsReady: {},
					},
				},
			}),
		fields: [
			AplHelpers.actionIdFieldConfig('spellId', 'channel_spells', ''),
			AplHelpers.unitFieldConfig('target', 'targets'),
			AplValues.valueFieldConfig('interruptIf', {
				label: i18n.t('rotation_tab.apl.actions.channel.interrupt_if.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.channel.interrupt_if.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('allowRecast', i18n.t('rotation_tab.apl.actions.channel.recast.label'), {
				labelTooltip: i18n.t('rotation_tab.apl.actions.channel.recast.tooltip'),
			}),
		],
	}),
	['castAllStatBuffCooldowns']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cast_all_stat_buff_cooldowns.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.cast_all_stat_buff_cooldowns.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.cast_all_stat_buff_cooldowns.full'),
		newValue: () =>
			APLActionCastAllStatBuffCooldowns.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		fields: [AplHelpers.statTypeFieldConfig('statType1'), AplHelpers.statTypeFieldConfig('statType2'), AplHelpers.statTypeFieldConfig('statType3')],
	}),
	['autocastOtherCooldowns']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.autocast_other_cooldowns.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.autocast_other_cooldowns.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.autocast_other_cooldowns.full'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: APLActionAutocastOtherCooldowns.create,
		fields: [],
	}),
	['wait']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.wait.label'),
		submenu: ['timing'],
		shortDescription: i18n.t('rotation_tab.apl.actions.wait.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: () =>
			APLActionWait.create({
				duration: {
					value: {
						oneofKind: 'const',
						const: {
							val: '1000ms',
						},
					},
				},
			}),
		fields: [AplValues.valueFieldConfig('duration')],
	}),
	['waitUntil']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.wait_until.label'),
		submenu: ['timing'],
		shortDescription: i18n.t('rotation_tab.apl.actions.wait_until.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: () => APLActionWaitUntil.create(),
		fields: [AplValues.valueFieldConfig('condition')],
	}),
	['schedule']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.scheduled_action.label'),
		submenu: ['timing'],
		shortDescription: i18n.t('rotation_tab.apl.actions.scheduled_action.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: () =>
			APLActionSchedule.create({
				schedule: '0s, 60s',
				innerAction: {
					action: { oneofKind: 'castSpell', castSpell: {} },
				},
			}),
		fields: [
			AplHelpers.stringFieldConfig('schedule', {
				label: i18n.t('rotation_tab.apl.actions.scheduled_action.do_at.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.scheduled_action.do_at.tooltip'),
			}),
			actionFieldConfig('innerAction'),
		],
	}),
	['sequence']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.sequence.label'),
		submenu: ['sequences'],
		shortDescription: i18n.t('rotation_tab.apl.actions.sequence.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.sequence.full'),
		includeIf: (_, isPrepull: boolean) => !isPrepull,
		newValue: APLActionSequence.create,
		fields: [AplHelpers.stringFieldConfig('name'), actionListFieldConfig('actions')],
	}),
	['resetSequence']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.reset_sequence.label'),
		submenu: ['sequences'],
		shortDescription: i18n.t('rotation_tab.apl.actions.reset_sequence.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.reset_sequence.full'),
		includeIf: (_, isPrepull: boolean) => !isPrepull,
		newValue: APLActionResetSequence.create,
		fields: [AplHelpers.stringFieldConfig('sequenceName')],
	}),
	['strictSequence']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.strict_sequence.label'),
		submenu: ['sequences'],
		shortDescription: i18n.t('rotation_tab.apl.actions.strict_sequence.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.strict_sequence.full'),
		includeIf: (_, isPrepull: boolean) => !isPrepull,
		newValue: APLActionStrictSequence.create,
		fields: [actionListFieldConfig('actions')],
	}),
	['changeTarget']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.change_target.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.change_target.tooltip'),
		newValue: () => APLActionChangeTarget.create(),
		fields: [AplHelpers.unitFieldConfig('newTarget', 'targets')],
	}),
	['activateAura']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.activate_aura.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.activate_aura.tooltip'),
		includeIf: (_, isPrepull: boolean) => isPrepull,
		newValue: () => APLActionActivateAura.create(),
		fields: [AplHelpers.actionIdFieldConfig('auraId', 'auras')],
	}),
	['activateAuraWithStacks']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.activate_aura_with_stacks.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.activate_aura_with_stacks.tooltip'),
		includeIf: (_, isPrepull: boolean) => isPrepull,
		newValue: () =>
			APLActionActivateAuraWithStacks.create({
				numStacks: 1,
			}),
		fields: [
			AplHelpers.actionIdFieldConfig('auraId', 'stackable_auras'),
			AplHelpers.numberFieldConfig('numStacks', false, {
				label: i18n.t('rotation_tab.apl.actions.activate_aura_with_stacks.stacks'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.activate_aura_with_stacks.stacks_tooltip'),
			}),
		],
	}),
	['activateAllStatBuffProcAuras']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.activate_all_stat_buff_proc_auras.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.activate_all_stat_buff_proc_auras.tooltip'),
		includeIf: (_, isPrepull: boolean) => isPrepull,
		newValue: () =>
			APLActionActivateAllStatBuffProcAuras.create({
				swapSet: ItemSwapSet.Main,
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		fields: [
			itemSwapSetFieldConfig('swapSet'),
			AplHelpers.statTypeFieldConfig('statType1'),
			AplHelpers.statTypeFieldConfig('statType2'),
			AplHelpers.statTypeFieldConfig('statType3'),
		],
	}),
	['cancelAura']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cancel_aura.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.cancel_aura.tooltip'),
		newValue: () => APLActionCancelAura.create(),
		fields: [AplHelpers.actionIdFieldConfig('auraId', 'auras')],
	}),
	['triggerIcd']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.trigger_icd.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.trigger_icd.tooltip'),
		includeIf: (_, isPrepull: boolean) => isPrepull,
		newValue: () => APLActionTriggerICD.create(),
		fields: [AplHelpers.actionIdFieldConfig('auraId', 'icd_auras')],
	}),
	['itemSwap']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.item_swap.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.item_swap.tooltip'),
		includeIf: (player: Player<any>, _isPrepull: boolean) => itemSwapEnabledSpecs.includes(player.getSpec()),
		newValue: () => APLActionItemSwap.create(),
		fields: [itemSwapSetFieldConfig('swapSet')],
	}),
	['move']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.move.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.move.tooltip'),
		newValue: () => APLActionMove.create(),
		fields: [
			AplValues.valueFieldConfig('rangeFromTarget', {
				label: i18n.t('rotation_tab.apl.actions.move.to_range'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.move.to_range_tooltip'),
			}),
		],
	}),
	['moveDuration']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.move.move_duration'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.move.move_duration_tooltip'),
		newValue: () => APLActionMoveDuration.create(),
		fields: [
			AplValues.valueFieldConfig('duration', {
				label: i18n.t('rotation_tab.apl.actions.move.duration'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.move.duration_tooltip'),
			}),
		],
	}),
	['customRotation']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.custom_rotation.label'),
		//submenu: ['Misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.custom_rotation.tooltip'),
		includeIf: (_player: Player<any>, _isPrepull: boolean) => false, // Never show this, because its internal only.
		newValue: () => APLActionCustomRotation.create(),
		fields: [],
	}),
	['groupReference']: inputBuilder({
		label: 'Group Reference',
		submenu: ['Groups'],
		shortDescription: 'References an action group defined in the Groups section.',
		fullDescription: `
			<p>Executes all actions in the referenced group in order. Groups allow you to create reusable action sequences.</p>
			<p>Example: If you have a group named "careful_aim" with actions [serpent_sting, chimera_shot, steady_shot],
			referencing this group will execute those three actions in sequence.</p>
		`,
		newValue: () =>
			APLActionGroupReference.create({
				groupName: '',
				variables: [],
			}),
		fields: [
			AplHelpers.groupNameFieldConfig('groupName', {
				labelTooltip: 'Name of the group to reference (must match a group defined in the Groups section)',
			}),
			AplHelpers.groupReferenceVariablesFieldConfig('variables', 'groupName', {
				label: 'Group Variables',
				labelTooltip: "Variables to pass to the group. These will override the group's internal variables.",
			}),
		],
	}),

	// Class/spec specific actions
	['catOptimalRotationAction']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.optimal_rotation_action.label'),
		submenu: ['feral_druid'],
		shortDescription: i18n.t('rotation_tab.apl.actions.optimal_rotation_action.tooltip'),
		includeIf: (player: Player<any>, _isPrepull: boolean) => player.getSpec() == Spec.SpecFeralDruid,
		newValue: () =>
			APLActionCatOptimalRotationAction.create({
				rotationType: FeralDruid_Rotation_AplType.SingleTarget,
				manualParams: true,
				minRoarOffset: 40,
				ripLeeway: 4,
				useBite: true,
				biteTime: 6,
				berserkBiteTime: 5,
				allowAoeBerserk: false,
				bearWeave: true,
				snekWeave: true,
				useNs: true,
				wrathWeave: false,
			}),
		fields: [
			AplHelpers.rotationTypeFieldConfig('rotationType'),
			AplHelpers.booleanFieldConfig('bearWeave', i18n.t('rotation_tab.options.druid.feral.bear_weave.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.bear_weave.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('snekWeave', i18n.t('rotation_tab.options.druid.feral.snek_weave.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.snek_weave.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('useNs', i18n.t('rotation_tab.options.druid.feral.use_ns.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.use_ns.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('wrathWeave', i18n.t('rotation_tab.apl.actions.optimal_rotation_action.wrath_weave.label'), {
				labelTooltip: i18n.t('rotation_tab.apl.actions.optimal_rotation_action.wrath_weave.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('allowAoeBerserk', i18n.t('rotation_tab.options.druid.feral.allow_aoe_berserk.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.allow_aoe_berserk.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('manualParams', i18n.t('rotation_tab.options.druid.feral.manual_params.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.manual_params.tooltip'),
			}),
			AplHelpers.numberFieldConfig('minRoarOffset', true, {
				label: i18n.t('rotation_tab.options.druid.feral.roar_offset.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.roar_offset.tooltip'),
			}),
			AplHelpers.numberFieldConfig('ripLeeway', false, {
				label: i18n.t('rotation_tab.options.druid.feral.rip_leeway.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.rip_leeway.tooltip'),
			}),
			AplHelpers.booleanFieldConfig('useBite', i18n.t('rotation_tab.options.druid.feral.bite_during_rotation.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.bite_during_rotation.tooltip'),
			}),
			AplHelpers.numberFieldConfig('biteTime', true, {
				label: i18n.t('rotation_tab.options.druid.feral.bite_time.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.bite_time.tooltip'),
			}),
			AplHelpers.numberFieldConfig('berserkBiteTime', true, {
				label: i18n.t('rotation_tab.options.druid.feral.berserk_bite_time.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.berserk_bite_time.tooltip'),
			}),
		],
	}),

	['guardianHotwDpsRotation']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.guardian_hotw_dps_rotation.label'),
		submenu: ['guardian_druid'],
		shortDescription: i18n.t('rotation_tab.apl.actions.guardian_hotw_dps_rotation.tooltip'),
		includeIf: (player: Player<any>, _isPrepull: boolean) => player.getSpec() == Spec.SpecGuardianDruid,
		newValue: () =>
			APLActionGuardianHotwDpsRotation.create({
				strategy: HotwStrategy.Caster,
			}),
		fields: [AplHelpers.hotwStrategyFieldConfig('strategy')],
	}),

	['warlockNextExhaleTarget']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.warlock_next_exhale_target.label'),
		submenu: ['warlock'],
		shortDescription: i18n.t('rotation_tab.apl.actions.warlock_next_exhale_target.tooltip'),
		includeIf: (player: Player<any>, _isPrepull: boolean) => player.getSpec() == Spec.SpecAfflictionWarlock,
		newValue: () =>
			APLActionWarlockNextExhaleTarget.create({}),
		fields: [],
	}),
};
