import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as OtherInputs from '@features/settings/model/other_inputs';
import { defineSpec } from '@features/spec_config';
import { StatCapType } from '@generated/proto/api';
import { APLRotation, APLRotation_Type } from '@generated/proto/apl';
import { Debuffs, HandType, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '@generated/proto/common';

import { amsIntakeRule } from '../shared/derived';
import * as DeathKnightInputs from '../shared/inputs';
import * as SharedPresets from '../shared/presets';
import * as Presets from './presets';

export default defineSpec<Spec.SpecFrostDeathKnight>({
	spec: Spec.SpecFrostDeathKnight,

	cssClass: 'frost-death-knight-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.DeathKnight),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStrength,
		Stat.StatAttackPower,
		Stat.StatExpertiseRating,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	consumableStats: [Stat.StatStrength, Stat.StatHitRating, Stat.StatHasteRating, Stat.StatCritRating, Stat.StatExpertiseRating, Stat.StatMasteryRating],
	gemStats: [
		Stat.StatStamina,
		Stat.StatStrength,
		Stat.StatHitRating,
		Stat.StatHasteRating,
		Stat.StatCritRating,
		Stat.StatExpertiseRating,
		Stat.StatMasteryRating,
	],
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatStrength, Stat.StatAttackPower, Stat.StatMasteryRating, Stat.StatExpertiseRating],
		[
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHastePercent,
			PseudoStat.PseudoStatPhysicalHitPercent,
			PseudoStat.PseudoStatPhysicalCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
		],
	),
	defaults: {
		// Default equipped gear.
		gear: Presets.P5_MASTERFROST_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.MASTERFROST_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: (() => {
			return new Stats();
		})(),
		softCapBreakpoints: (() => {
			const physicalHitPercentSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, {
				breakpoints: [7.5, 27],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0, 0],
			});

			const expertiseRatingSoftCapConfig = StatCap.fromStat(Stat.StatExpertiseRating, {
				breakpoints: [7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0],
			});

			return [physicalHitPercentSoftCapConfig, expertiseRatingSoftCapConfig];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: SharedPresets.DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			curseOfElements: true,
			physicalVulnerability: true,
			weakenedArmor: true,
			weakenedBlows: true,
		}),
		rotationType: APLRotation_Type.TypeAuto,
		encounter: SharedPresets.ENCOUNTER_MALKOROK,
	},

	autoRotation: (player: Player<Spec.SpecFrostDeathKnight>): APLRotation => {
		const mainHand = player.getEquippedItem(ItemSlot.ItemSlotMainHand);
		if (mainHand?.item?.handType === HandType.HandTypeTwoHand) {
			return Presets.OBLITERATE_ROTATION_PRESET_DEFAULT.rotation.rotation!;
		} else {
			return Presets.MASTERFROST_ROTATION_PRESET_DEFAULT.rotation.rotation!;
		}
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	petConsumeInputs: [],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.SpellDamageDebuff, BuffDebuffInputs.SpellHasteBuff],
	excludeBuffDebuffInputs: [BuffDebuffInputs.DamageReduction, BuffDebuffInputs.CastSpeedDebuff],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			OtherInputs.InFrontOfTarget,
			OtherInputs.InputDelay,
			DeathKnightInputs.AvgAMSHitInput,
			DeathKnightInputs.AvgAMSSuccessRateInput,
			DeathKnightInputs.AMSNumTicksInput,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.MASTERFROST_EP_PRESET, Presets.TWOHAND_OBLITERATE_EP_PRESET],
		talents: [Presets.DefaultTalents],
		rotations: [Presets.MASTERFROST_ROTATION_PRESET_DEFAULT, Presets.OBLITERATE_ROTATION_PRESET_DEFAULT],
		encounters: [SharedPresets.ENCOUNTER_MALKOROK, SharedPresets.ENCOUNTER_SINGLE_TARGET],
		gear: [
			Presets.PREBIS_MASTERFROST_GEAR_PRESET,
			Presets.PREBIS_2H_OBLITERATE_GEAR_PRESET,
			Presets.P5_MASTERFROST_GEAR_PRESET,
			Presets.P5_2H_OBLITERATE_GEAR_PRESET,
		],
		builds: [Presets.PRESET_BUILD_P5_MASTERFROST, Presets.PRESET_BUILD_P5_2H_OBLITERATE],
	},

	reforge: {
		updateSoftCaps: (softCaps: StatCap[], player: Player<Spec.SpecFrostDeathKnight>) => {
			const mainHand = player.getEquippedItem(ItemSlot.ItemSlotMainHand);
			if (mainHand?.item?.handType === HandType.HandTypeTwoHand) {
				const physicalHitCap = softCaps.find(v => v.unitStat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent));
				if (physicalHitCap) {
					physicalHitCap.breakpoints = [7.5];
					physicalHitCap.postCapEPs = [0];
				}
			} else {
				const physicalHitCap = softCaps.find(v => v.unitStat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent));
				if (physicalHitCap) {
					physicalHitCap.postCapEPs[0] = player.getEpWeights().getStat(Stat.StatHitRating) * 0.3 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT;
				}
			}
			return softCaps;
		},
		getEPDefaults: (player: Player<Spec.SpecFrostDeathKnight>) => {
			const mainHand = player.getEquippedItem(ItemSlot.ItemSlotMainHand);
			return mainHand?.item?.handType === HandType.HandTypeTwoHand
				? Presets.TWOHAND_OBLITERATE_EP_PRESET.epWeights
				: Presets.MASTERFROST_EP_PRESET.epWeights;
		},
	},
	derivedSettings: [amsIntakeRule],
});
