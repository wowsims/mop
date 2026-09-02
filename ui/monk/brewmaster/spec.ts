import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import * as StatCaps from '@domain/presets/stat_caps';
import { UnitStat } from '@domain/proto_utils/stats';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import { APLRotation } from '../../core/proto/apl';
import { Debuffs, IndividualBuffs, PartyBuffs, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { talentBasedSettingsRule } from '../shared/derived';
import * as MonkPresets from '../shared/presets';
import * as Presets from './presets';

export default defineSpec<Spec.SpecBrewmasterMonk>({
	spec: Spec.SpecBrewmasterMonk,

	cssClass: 'brewmaster-monk-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Monk),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatAgility,
		Stat.StatStamina,
		Stat.StatArmor,
		Stat.StatAttackPower,
		Stat.StatCritRating,
		Stat.StatDodgeRating,
		Stat.StatParryRating,
		Stat.StatHitRating,
		Stat.StatExpertiseRating,
		Stat.StatHasteRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatAgility,
	consumableStats: [
		Stat.StatAgility,
		Stat.StatArmor,
		Stat.StatBonusArmor,
		Stat.StatStamina,
		Stat.StatAttackPower,
		Stat.StatDodgeRating,
		Stat.StatParryRating,
		Stat.StatHitRating,
		Stat.StatHasteRating,
		Stat.StatCritRating,
		Stat.StatExpertiseRating,
		Stat.StatMasteryRating,
	],
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatArmor,
			Stat.StatStamina,
			Stat.StatAgility,
			Stat.StatStrength,
			Stat.StatAttackPower,
			Stat.StatMasteryRating,
			Stat.StatExpertiseRating,
		],
		[
			PseudoStat.PseudoStatPhysicalHitPercent,
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatPhysicalCritPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
			PseudoStat.PseudoStatDodgePercent,
			PseudoStat.PseudoStatParryPercent,
		],
	),

	defaultBuild: Presets.PRESET_BUILD_HORRIDON,

	defaults: {
		// Default equipped gear.
		gear: Presets.P3_4_BIS_DW_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P3_4_BALANCED_EP_PRESET.epWeights,
		// Stat caps for reforge optimizer
		statCaps: StatCaps.meleeHitExpertiseCaps(15),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: MonkPresets.DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			curseOfElements: true,
			physicalVulnerability: true,
			weakenedArmor: true,
		}),
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.CritBuff, BuffDebuffInputs.MajorArmorDebuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			OtherInputs.InputDelay,
			OtherInputs.TankAssignment,
			OtherInputs.IncomingHps,
			OtherInputs.HealingCadence,
			OtherInputs.HealingCadenceVariation,
			OtherInputs.AbsorbFrac,
			OtherInputs.BurstWindow,
			OtherInputs.HpPercentForDefensives,
			OtherInputs.InFrontOfTarget,
		],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P3_4_BALANCED_EP_PRESET, Presets.P3_4_OFFENSIVE_EP_PRESET, Presets.P5_BALANCED_EP_PRESET, Presets.P5_OFFENSIVE_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DefaultTalents, Presets.DungeonTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET, Presets.ROTATION_OFFENSIVE_PRESET, Presets.ROTATION_HORRIDON_PRESET, Presets.ROTATION_IRON_JUGGERNAUT_PRESET],
		// Preset gear configurations that the user can quickly select.
		gear: [
			Presets.PREBIS_GEAR_PRESET,
			Presets.P3_4_BIS_DW_GEAR_PRESET,
			Presets.P3_4_BIS_OFFENSIVE_DW_GEAR_PRESET,
			Presets.P5_PROG_DW_GEAR_PRESET,
			Presets.P5_BIS_DW_GEAR_PRESET,
			Presets.P5_BIS_OFFENSIVE_DW_GEAR_PRESET,
		],
		builds: [
			// Presets.PRESET_BUILD_GARAJAL,
			// Presets.PRESET_BUILD_SHA,
			Presets.PRESET_BUILD_HORRIDON,
			Presets.PRESET_BUILD_IRON_JUGGERNAUT,
		],
	},

	autoRotation: (_: Player<Spec.SpecBrewmasterMonk>): APLRotation => {
		return Presets.ROTATION_PRESET.rotation.rotation!;
	},

	reforge: {
		getEPDefaults: player => player.getEpWeights(),
	},
	derivedSettings: [talentBasedSettingsRule],
});
