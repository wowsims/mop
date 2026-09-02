import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import * as StatCaps from '@domain/presets/stat_caps';
import { StatCap, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '../../core/proto/common';
import * as WarriorInputs from '../shared/inputs';
import * as SharedPresets from '../shared/presets';
import * as Presets from './presets';

export default defineSpec<Spec.SpecArmsWarrior>({
	spec: Spec.SpecArmsWarrior,

	cssClass: 'arms-warrior-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Warrior),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStrength,
		Stat.StatAgility,
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
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatStamina, Stat.StatStrength, Stat.StatAgility, Stat.StatAttackPower, Stat.StatExpertiseRating, Stat.StatMasteryRating],
		[PseudoStat.PseudoStatPhysicalHitPercent, PseudoStat.PseudoStatPhysicalCritPercent, PseudoStat.PseudoStatMeleeHastePercent],
	),
	// modifyDisplayStats: (player: Player<Spec.SpecArmsWarrior>) => {
	// 	let stats = new Stats();
	// 	if (!player.getInFrontOfTarget()) {
	// 		// When behind target, dodge is the only outcome affected by Expertise.
	// 		stats = stats.addStat(Stat.StatExpertise, player.getTalents().weaponMastery * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);
	// 	}
	// 	return {
	// 		talents: stats,
	// 	};
	// },

	defaults: {
		// Default equipped gear.
		gear: Presets.P2_ARMS_BIS_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: StatCaps.meleeHitExpertiseCaps(),
		softCapBreakpoints: (() => {
			return [
				StatCap.fromStat(Stat.StatMasteryRating, {
					breakpoints: [(100 / Mechanics.masteryPercentPerPoint.get(Spec.SpecArmsWarrior)!) * Mechanics.MASTERY_RATING_PER_MASTERY_POINT],
					capType: StatCapType.TypeSoftCap,
					postCapEPs: [0],
				}),
			];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.ArmsTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: SharedPresets.DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			physicalVulnerability: true,
			weakenedArmor: true,
			masterPoisoner: true,
		}),
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			WarriorInputs.StanceSnapshot(),
			OtherInputs.DistanceFromTarget,
			OtherInputs.InputDelay,
			OtherInputs.TankAssignment,
			OtherInputs.InFrontOfTarget,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.P1_EP_PRESET, Presets.P2_EP_PRESET, Presets.P5_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.ArmsTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_ARMS],
		encounters: [SharedPresets.ENCOUNTER_SINGLE_TARGET, SharedPresets.ENCOUNTER_MALKOROK],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PREBIS_PRESET, Presets.P2_ARMS_BIS_PRESET, Presets.P3_4_ARMS_BIS_PRESET, Presets.P5_ARMS_BIS_PRESET],
	},

	autoRotation: (_player: Player<Spec.SpecArmsWarrior>): APLRotation => {
		return Presets.ROTATION_ARMS.rotation.rotation!;
	},

	reforge: {
		getEPDefaults: player => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (avgIlvl >= 560) return Presets.P5_EP_PRESET.epWeights;
			if (avgIlvl >= 500) return Presets.P2_EP_PRESET.epWeights;
			return Presets.P1_EP_PRESET.epWeights;
		},
		updateSoftCaps: (softCaps, player, ctx) => {
			const gear = player.getGear();
			// const avgIlvl = gear.getAverageItemLevel(false);
			const hasT154P = gear.getItemSetCount('Battleplate of the Last Mogu') >= 4;
			const epWeights = ctx.reforger.preCapEPs;

			if (epWeights) {
				softCaps.push(
					StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent, {
						breakpoints: [hasT154P ? 43 : 49],
						capType: StatCapType.TypeSoftCap,
						postCapEPs: [(epWeights.getStat(Stat.StatMasteryRating) - 0.02) * Mechanics.CRIT_RATING_PER_CRIT_PERCENT],
					}),
				);
			}

			return softCaps;
		},
	},
});
