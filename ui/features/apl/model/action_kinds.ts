import { Player } from '@domain/player';
import { itemSwapEnabledSpecs } from '@features/spec_config';
import {
	APLAction,
	APLActionActivateAllStatBuffProcAuras,
	APLActionActivateAura,
	APLActionActivateAuraWithStacks,
	APLActionAutocastOtherCooldowns,
	APLActionCancelAura,
	APLActionCancelSpellCast,
	APLActionCastAllStatBuffCooldowns,
	APLActionCastFriendlySpell,
	APLActionCastSpell,
	APLActionCatOptimalRotationAction,
	APLActionChangeTarget,
	APLActionChannelSpell,
	APLActionCustomRotation,
	APLActionDamageAmplifier,
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
	APLActionWarlockNextExhaleTarget,
} from '@generated/proto/apl';
import { Spec } from '@generated/proto/common';
import { FeralDruid_Rotation_AplType } from '@generated/proto/druid';
import i18n from '@i18n/config';

import {
	actionFieldConfig,
	actionIdFieldConfig,
	actionListFieldConfig,
	APLFieldDescriptor,
	booleanFieldConfig,
	damageAmpTypeFieldConfig,
	groupNameFieldConfig,
	groupReferenceVariablesFieldConfig,
	hotwStrategyFieldConfig,
	itemSwapSetFieldConfig,
	numberFieldConfig,
	rotationTypeFieldConfig,
	statTypeFieldConfig,
	stringFieldConfig,
	unitFieldConfig,
	valueFieldConfig,
} from './field_descriptors';

export type APLActionKind = APLAction['action']['oneofKind'];
export type APLActionImplStruct<F extends APLActionKind> = Extract<APLAction['action'], { oneofKind: F }>;
export type APLActionImplTypesUnion = {
	[f in NonNullable<APLActionKind>]: f extends keyof APLActionImplStruct<f> ? APLActionImplStruct<f>[f] : never;
};
export type APLActionImplType = APLActionImplTypesUnion[NonNullable<APLActionKind>] | undefined;

// The DOM-free half of an APL action kind. `view/apl_actions.ts` merges this with
// a `factory` built from `fields` to produce `actionKindFactories`.
export type ActionKindModel<T> = {
	label: string;
	submenu?: Array<string>;
	shortDescription: string;
	fullDescription?: string;
	includeIf?: (player: Player<any>, isPrepull: boolean) => boolean;
	newValue: () => T;
	fields: Array<APLFieldDescriptor>;
};

function inputBuilder<T>(config: ActionKindModel<T>): ActionKindModel<T> {
	return config;
}

export const actionKinds: { [f in NonNullable<APLActionKind>]: ActionKindModel<APLActionImplTypesUnion[f]> } = {
	['castSpell']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cast.label'),
		shortDescription: i18n.t('rotation_tab.apl.actions.cast.tooltip'),
		newValue: APLActionCastSpell.create,
		fields: [actionIdFieldConfig('spellId', 'castable_spells', ''), unitFieldConfig('target', 'targets')],
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
		fields: [actionIdFieldConfig('spellId', 'friendly_spells', ''), unitFieldConfig('target', 'players')],
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
			actionIdFieldConfig('spellId', 'castable_dot_spells', ''),
			numberFieldConfig('maxDots', false, {
				label: i18n.t('rotation_tab.apl.actions.multi_dot.max_dots.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_dot.max_dots.tooltip'),
			}),
			valueFieldConfig('maxOverlap', {
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
			actionIdFieldConfig('spellId', 'castable_dot_spells', ''),
			numberFieldConfig('maxDots', false, {
				label: i18n.t('rotation_tab.apl.actions.strict_multi_dot.max_dots.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.strict_multi_dot.max_dots.tooltip'),
			}),
			valueFieldConfig('maxOverlap', {
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
			actionIdFieldConfig('spellId', 'shield_spells', ''),
			numberFieldConfig('maxShields', false, {
				label: i18n.t('rotation_tab.apl.actions.multi_shield.max_shields.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_shield.max_shields.tooltip'),
			}),
			valueFieldConfig('maxOverlap', {
				label: i18n.t('rotation_tab.apl.actions.multi_shield.overlap.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.multi_shield.overlap.tooltip'),
			}),
		],
	}),
	['channelSpell']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.channel.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.channel.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.channel.full_description'),
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
			actionIdFieldConfig('spellId', 'channel_spells', ''),
			unitFieldConfig('target', 'targets'),
			valueFieldConfig('interruptIf', {
				label: i18n.t('rotation_tab.apl.actions.channel.interrupt_if.label'),
				labelTooltip: i18n.t('rotation_tab.apl.actions.channel.interrupt_if.tooltip'),
			}),
			booleanFieldConfig('allowRecast', i18n.t('rotation_tab.apl.actions.channel.recast.label'), {
				labelTooltip: i18n.t('rotation_tab.apl.actions.channel.recast.tooltip'),
			}),
		],
	}),
	['castAllStatBuffCooldowns']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cast_all_stat_buff_cooldowns.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.cast_all_stat_buff_cooldowns.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.cast_all_stat_buff_cooldowns.full_description'),
		newValue: () =>
			APLActionCastAllStatBuffCooldowns.create({
				statType1: -1,
				statType2: -1,
				statType3: -1,
			}),
		fields: [statTypeFieldConfig('statType1'), statTypeFieldConfig('statType2'), statTypeFieldConfig('statType3')],
	}),
	['autocastOtherCooldowns']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.autocast_other_cooldowns.label'),
		submenu: ['casting'],
		shortDescription: i18n.t('rotation_tab.apl.actions.autocast_other_cooldowns.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.autocast_other_cooldowns.full_description'),
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
		fields: [valueFieldConfig('duration')],
	}),
	['waitUntil']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.wait_until.label'),
		submenu: ['timing'],
		shortDescription: i18n.t('rotation_tab.apl.actions.wait_until.tooltip'),
		includeIf: (player: Player<any>, isPrepull: boolean) => !isPrepull,
		newValue: () => APLActionWaitUntil.create(),
		fields: [valueFieldConfig('condition')],
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
			stringFieldConfig('schedule', {
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
		fullDescription: i18n.t('rotation_tab.apl.actions.sequence.full_description'),
		includeIf: (_, isPrepull: boolean) => !isPrepull,
		newValue: APLActionSequence.create,
		fields: [stringFieldConfig('name'), actionListFieldConfig('actions')],
	}),
	['resetSequence']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.reset_sequence.label'),
		submenu: ['sequences'],
		shortDescription: i18n.t('rotation_tab.apl.actions.reset_sequence.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.reset_sequence.full_description'),
		includeIf: (_, isPrepull: boolean) => !isPrepull,
		newValue: APLActionResetSequence.create,
		fields: [stringFieldConfig('sequenceName')],
	}),
	['strictSequence']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.strict_sequence.label'),
		submenu: ['sequences'],
		shortDescription: i18n.t('rotation_tab.apl.actions.strict_sequence.tooltip'),
		fullDescription: i18n.t('rotation_tab.apl.actions.strict_sequence.full_description'),
		includeIf: (_, isPrepull: boolean) => !isPrepull,
		newValue: APLActionStrictSequence.create,
		fields: [actionListFieldConfig('actions')],
	}),
	['changeTarget']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.change_target.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.change_target.tooltip'),
		newValue: () => APLActionChangeTarget.create(),
		fields: [unitFieldConfig('newTarget', 'targets')],
	}),
	['activateAura']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.activate_aura.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.activate_aura.tooltip'),
		includeIf: (_, isPrepull: boolean) => isPrepull,
		newValue: () => APLActionActivateAura.create(),
		fields: [actionIdFieldConfig('auraId', 'auras')],
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
			actionIdFieldConfig('auraId', 'stackable_auras'),
			numberFieldConfig('numStacks', false, {
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
		fields: [itemSwapSetFieldConfig('swapSet'), statTypeFieldConfig('statType1'), statTypeFieldConfig('statType2'), statTypeFieldConfig('statType3')],
	}),
	['cancelAura']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.cancel_aura.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.cancel_aura.tooltip'),
		newValue: () => APLActionCancelAura.create(),
		fields: [actionIdFieldConfig('auraId', 'auras')],
	}),
	['triggerIcd']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.trigger_icd.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.trigger_icd.tooltip'),
		includeIf: (_, isPrepull: boolean) => isPrepull,
		newValue: () => APLActionTriggerICD.create(),
		fields: [actionIdFieldConfig('auraId', 'icd_auras')],
	}),
	['damageAmplifier']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.damage_amplification.label'),
		submenu: ['misc'],
		shortDescription: i18n.t('rotation_tab.apl.actions.damage_amplification.tooltip'),
		newValue: () => APLActionDamageAmplifier.create(),
		fields: [
			numberFieldConfig('amount', false, {
				label: i18n.t('rotation_tab.apl.actions.damage_amplification.amount.label'),
			}),
			damageAmpTypeFieldConfig('ampType'),
		],
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
			valueFieldConfig('rangeFromTarget', {
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
			valueFieldConfig('duration', {
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
			groupNameFieldConfig('groupName', {
				labelTooltip: 'Name of the group to reference (must match a group defined in the Groups section)',
			}),
			groupReferenceVariablesFieldConfig('variables', 'groupName', {
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
			rotationTypeFieldConfig('rotationType'),
			booleanFieldConfig('bearWeave', i18n.t('rotation_tab.options.druid.feral.bear_weave.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.bear_weave.tooltip'),
			}),
			booleanFieldConfig('snekWeave', i18n.t('rotation_tab.options.druid.feral.snek_weave.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.snek_weave.tooltip'),
			}),
			booleanFieldConfig('useNs', i18n.t('rotation_tab.options.druid.feral.use_ns.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.use_ns.tooltip'),
			}),
			booleanFieldConfig('wrathWeave', i18n.t('rotation_tab.apl.actions.optimal_rotation_action.wrath_weave.label'), {
				labelTooltip: i18n.t('rotation_tab.apl.actions.optimal_rotation_action.wrath_weave.tooltip'),
			}),
			booleanFieldConfig('allowAoeBerserk', i18n.t('rotation_tab.options.druid.feral.allow_aoe_berserk.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.allow_aoe_berserk.tooltip'),
			}),
			booleanFieldConfig('manualParams', i18n.t('rotation_tab.options.druid.feral.manual_params.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.manual_params.tooltip'),
			}),
			numberFieldConfig('minRoarOffset', true, {
				label: i18n.t('rotation_tab.options.druid.feral.roar_offset.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.roar_offset.tooltip'),
			}),
			numberFieldConfig('ripLeeway', false, {
				label: i18n.t('rotation_tab.options.druid.feral.rip_leeway.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.rip_leeway.tooltip'),
			}),
			booleanFieldConfig('useBite', i18n.t('rotation_tab.options.druid.feral.bite_during_rotation.label'), {
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.bite_during_rotation.tooltip'),
			}),
			numberFieldConfig('biteTime', true, {
				label: i18n.t('rotation_tab.options.druid.feral.bite_time.label'),
				labelTooltip: i18n.t('rotation_tab.options.druid.feral.bite_time.tooltip'),
			}),
			numberFieldConfig('berserkBiteTime', true, {
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
		fields: [hotwStrategyFieldConfig('strategy')],
	}),

	['warlockNextExhaleTarget']: inputBuilder({
		label: i18n.t('rotation_tab.apl.actions.warlock_next_exhale_target.label'),
		submenu: ['warlock'],
		shortDescription: i18n.t('rotation_tab.apl.actions.warlock_next_exhale_target.tooltip'),
		includeIf: (player: Player<any>, _isPrepull: boolean) => player.getSpec() == Spec.SpecAfflictionWarlock,
		newValue: () => APLActionWarlockNextExhaleTarget.create({}),
		fields: [],
	}),
};
