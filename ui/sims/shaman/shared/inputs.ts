import { Player } from '@domain/player';
import { ActionId } from '@domain/proto_utils/action_id';
import { ShamanSpecs } from '@domain/proto_utils/utils';
import { EventID } from '@domain/state/batch';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import type { CustomSection } from '@features/spec_config';
import { Spec } from '@generated/proto/common';
import { ShamanImbue, ShamanShield } from '@generated/proto/shaman';
import i18n from '@i18n/config';
import * as InputHelpers from '@ui-kit/input_helpers';
// Configuration for class-specific UI elements on the settings tab.
// These don't need to be in a separate file but it keeps things cleaner.

export const ShamanShieldInput = <SpecType extends ShamanSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, ShamanShield>({
		fieldName: 'shield',
		values: [
			{ value: ShamanShield.NoShield, tooltip: 'No Shield' },
			{ actionId: ActionId.fromSpellId(52127), value: ShamanShield.WaterShield },
			{ actionId: ActionId.fromSpellId(324), value: ShamanShield.LightningShield },
		],
	});

export const ShamanImbueMH = <SpecType extends ShamanSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, ShamanImbue>({
		fieldName: 'imbueMh',
		values: [
			{ value: ShamanImbue.NoImbue, tooltip: 'No Main Hand Enchant' },
			{ actionId: ActionId.fromSpellId(8232), value: ShamanImbue.WindfuryWeapon },
			{ actionId: ActionId.fromSpellId(8024), value: ShamanImbue.FlametongueWeapon },
			{ actionId: ActionId.fromSpellId(8033), value: ShamanImbue.FrostbrandWeapon },
		],
	});

export const ShamanImbueMHSwap = <SpecType extends ShamanSpecs>() =>
	InputHelpers.makeClassOptionsEnumIconInput<SpecType, ShamanImbue>({
		fieldName: 'imbueMhSwap',
		values: [
			{ value: ShamanImbue.NoImbue, tooltip: 'No Main Hand Swap Enchant' },
			{ actionId: ActionId.fromSpellId(8232), value: ShamanImbue.WindfuryWeapon },
			{ actionId: ActionId.fromSpellId(8024), value: ShamanImbue.FlametongueWeapon },
		],
		showWhen: (player: Player<SpecType>) => player.itemSwapSettings.getEnableItemSwap(),
		storeSubscribe: (player: Player<SpecType>) => subscribeAll([subscribePlayerField(player, 'specOptions'), subscribePlayerField(player, 'itemSwap')]),
	});

type FeleAutocastFlag = 'autocastFireblast' | 'autocastFirenova' | 'autocastImmolate' | 'autocastEmpower';

const feleAutocastIconInput = <SpecType extends ShamanSpecs>(spellId: number, flag: FeleAutocastFlag) =>
	InputHelpers.makeClassOptionsBooleanIconInput<SpecType>({
		fieldName: 'feleAutocast',
		id: ActionId.fromSpellId(spellId),
		getValue: (player: Player<SpecType>) => player.getClassOptions().feleAutocast![flag],
		setValue: (eventID: EventID, player: Player<SpecType>, newValue: boolean) => {
			const newOptions = player.getClassOptions();
			newOptions.feleAutocast![flag] = newValue;
			player.setClassOptions(eventID, newOptions);
		},
		storeSubscribe: (player: Player<SpecType>) => subscribePlayerField(player, 'specOptions'),
	});

// The Fire Elemental autocast toggles every shaman spec that shows totems gets.
export const totemsSection = <SpecType extends ShamanSpecs>(): CustomSection<SpecType> => ({
	id: 'totems',
	title: 'Totems',
	cssClass: 'totems-settings',
	iconGroupCssClass: 'totem-dropdowns-container',
	iconInputs: [
		feleAutocastIconInput<SpecType>(57984, 'autocastFireblast'),
		feleAutocastIconInput<SpecType>(117588, 'autocastFirenova'),
		feleAutocastIconInput<SpecType>(118297, 'autocastImmolate'),
		feleAutocastIconInput<SpecType>(118350, 'autocastEmpower'),
	],
});

// Enhancement additionally controls whether Immolate is suppressed during a
// Windfury unleash, and for how long.
export const enhancementTotemsSection = (): CustomSection<Spec.SpecEnhancementShaman> => ({
	...totemsSection<Spec.SpecEnhancementShaman>(),
	inputs: [
		InputHelpers.makeClassOptionsBooleanInput<ShamanSpecs>({
			fieldName: 'feleAutocast',
			label: i18n.t('settings_tab.other.shaman_disable_immolate.label'),
			labelTooltip: i18n.t('settings_tab.other.shaman_disable_immolate.tooltip'),
			getValue: player => player.getClassOptions().feleAutocast?.noImmolateWfunleash || false,
			setValue: (eventID, player, newVal) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.noImmolateWfunleash = newVal;
				player.setClassOptions(eventID, newOptions);
			},
		}),
		InputHelpers.makeClassOptionsNumberInput<ShamanSpecs>({
			fieldName: 'feleAutocast',
			label: i18n.t('settings_tab.other.shaman_disable_immolate_duration.label'),
			labelTooltip: i18n.t('settings_tab.other.shaman_disable_immolate_duration.tooltip'),
			float: true,
			getValue: player => player.getClassOptions().feleAutocast?.noImmolateDuration || 0,
			setValue: (eventID, player, newVal) => {
				const newOptions = player.getClassOptions();
				newOptions.feleAutocast!.noImmolateDuration = newVal;
				player.setClassOptions(eventID, newOptions);
			},
			showWhen: player => player.getClassOptions().feleAutocast!.noImmolateWfunleash,
		}),
	],
});
