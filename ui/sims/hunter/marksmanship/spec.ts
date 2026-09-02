import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { Stats, UnitStat } from '@domain/proto_utils/stats';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as OtherInputs from '@features/settings/model/other_inputs';
import { defineSpec } from '@features/spec_config';
import { APLRotation } from '@generated/proto/apl';
import { Debuffs, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '@generated/proto/common';

import * as HunterInputs from '../shared/inputs';
import * as HunterPresets from '../shared/presets';
import * as Presets from './presets';

export default defineSpec<Spec.SpecMarksmanshipHunter>({
	spec: Spec.SpecMarksmanshipHunter,

	cssClass: 'marksmanship-hunter-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Hunter),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: ['Glaive Toss hits AoE targets only once.'],
	warnings: [],
	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatAgility,
		Stat.StatRangedAttackPower,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatMasteryRating,
		Stat.StatExpertiseRating,
	],
	gemStats: [
		Stat.StatStamina,
		Stat.StatAgility,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatMasteryRating,
		Stat.StatExpertiseRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatRangedDps],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatAgility,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatStamina, Stat.StatAgility, Stat.StatRangedAttackPower, Stat.StatMasteryRating, Stat.StatExpertiseRating],
		[PseudoStat.PseudoStatPhysicalHitPercent, PseudoStat.PseudoStatPhysicalCritPercent, PseudoStat.PseudoStatRangedHastePercent],
	),
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	defaults: {
		// Default equipped gear.
		gear: Presets.P5_PRESET_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P5_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: Stats.fromMap(
			{
				[Stat.StatExpertiseRating]: 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION,
			},
			{
				[PseudoStat.PseudoStatPhysicalHitPercent]: 7.5,
			},
		),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.MMDefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: HunterPresets.DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			weakenedArmor: true,
			physicalVulnerability: true,
			curseOfElements: true,
		}),
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [HunterInputs.PetTypeInput()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.StaminaBuff, BuffDebuffInputs.SpellDamageDebuff, BuffDebuffInputs.MajorArmorDebuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [HunterInputs.PetUptime(), HunterInputs.GlaiveTossChance(), OtherInputs.InputDelay, OtherInputs.DistanceFromTarget, OtherInputs.TankAssignment],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P5_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DefaultTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_MM, Presets.ROTATION_PRESET_AOE],
		// Preset gear configurations that the user can quickly select.
		builds: [Presets.P5_PRESET],
		gear: [Presets.PRERAID_PRESET_GEAR, Presets.P5_PRESET_GEAR],
	},

	autoRotation: (_: Player<Spec.SpecMarksmanshipHunter>): APLRotation => {
		return Presets.ROTATION_PRESET_MM.rotation.rotation!;
	},

	reforge: {},
});
