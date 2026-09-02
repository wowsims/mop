import { StatCapType } from '@core/proto/api';
import { APLRotation } from '@core/proto/apl';
import { Debuffs, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '@core/proto/common';
import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import * as StatCaps from '@domain/presets/stat_caps';
import { StatCap, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import * as WarriorInputs from '../shared/inputs';
import * as SharedPresets from '../shared/presets';
import * as FuryInputs from './inputs';
import * as Presets from './presets';

const P2HitPostCapEPs = [0, 0];
const P3HitPostCapEPs = [0.42 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT, 0];
const P5HitPostCapEPs = [0.42 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT, 0];

export default defineSpec<Spec.SpecFuryWarrior>({
	spec: Spec.SpecFuryWarrior,

	cssClass: 'fury-warrior-sim-ui',
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
	// modifyDisplayStats: (player: Player<Spec.SpecFuryWarrior>) => {
	// 	//let stats = new Stats();
	// 	if (!player.getInFrontOfTarget()) {
	// 		// When behind target, dodge is the only outcome affected by Expertise.
	// 		//stats = stats.addStat(Stat.StatExpertise, player.getTalents().weaponMastery * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);
	// 	}
	// 	return {
	// 	//	talents: stats,
	// 	};
	// },

	defaults: {
		// Default equipped gear.
		gear: Presets.P2_BIS_FURY_TG_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P2_FURY_TG_EP_PRESET.epWeights,
		// Stat caps for reforge optimizer
		statCaps: StatCaps.expertiseCap(),
		softCapBreakpoints: (() => {
			const meleeHitSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, {
				breakpoints: [7.5, 27],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: P2HitPostCapEPs,
			});

			return [meleeHitSoftCapConfig];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.FuryTGTalents.data,
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
			FuryInputs.SyncTypeInput,
			WarriorInputs.StanceSnapshot(),
			OtherInputs.DistanceFromTarget,
			OtherInputs.InputDelay,
			OtherInputs.TankAssignment,
			OtherInputs.InFrontOfTarget,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.P2_FURY_SMF_EP_PRESET, Presets.P2_FURY_TG_EP_PRESET, Presets.P3_4_FURY_TG_EP_PRESET, Presets.P5_FURY_TG_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.FurySMFTalents, Presets.FuryTGTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.FURY_DEFAULT_ROTATION],
		encounters: [SharedPresets.ENCOUNTER_SINGLE_TARGET, SharedPresets.ENCOUNTER_MALKOROK],
		// Preset gear configurations that the user can quickly select.
		gear: [
			Presets.PRERAID_FURY_SMF_PRESET,
			Presets.PRERAID_FURY_TG_PRESET,
			Presets.P2_BIS_FURY_SMF_PRESET,
			Presets.P2_BIS_FURY_TG_PRESET,
			Presets.P3_4_BIS_FURY_TG_PRESET,
			Presets.P5_BIS_FURY_TG_PRESET,
		],
		builds: [Presets.P3_4_PRESET_BUILD_TG, Presets.P5_PRESET_BUILD_TG],
	},

	autoRotation: (_player: Player<Spec.SpecFuryWarrior>): APLRotation => {
		return Presets.FURY_DEFAULT_ROTATION.rotation.rotation!;
	},

	reforge: {
		getEPDefaults: player => {
			const avgIlvl = player.getGear().getAverageItemLevel(player.canDualWield2H());
			if (avgIlvl >= 560) return Presets.P5_FURY_TG_EP_PRESET.epWeights;
			if (avgIlvl >= 517) return Presets.P3_4_FURY_TG_EP_PRESET.epWeights;
			return Presets.P2_FURY_TG_EP_PRESET.epWeights;
		},
		updateSoftCaps: (softCaps, player, ctx) => {
			const avgIlvl = player.getGear().getAverageItemLevel(player.canDualWield2H());
			// const gear = player.getGear();
			// const avgIlvl = gear.getAverageItemLevel(false);
			// const hasT154P = gear.getItemSetCount('Battleplate of the Last Mogu') >= 4;
			const epWeights = ctx.reforger.preCapEPs;

			ctx.defaults.softCapBreakpoints!.forEach(softCap => {
				const softCapToModify = softCaps.find(sc => sc.unitStat.equals(softCap.unitStat));
				if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent) && softCapToModify) {
					if (avgIlvl >= 560) {
						softCapToModify.postCapEPs = P5HitPostCapEPs;
					} else if (avgIlvl >= 517) {
						softCapToModify.postCapEPs = P3HitPostCapEPs;
					} else {
						softCapToModify.postCapEPs = P2HitPostCapEPs;
					}
				}
			});

			if (epWeights) {
				softCaps.push(
					StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent, {
						breakpoints: [53],
						capType: StatCapType.TypeSoftCap,
						postCapEPs: [(epWeights.getStat(Stat.StatMasteryRating) / player.getTotalAmplificationTrinketStatModifier()) * 0.8 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT],
					}),
				);
			}
			return softCaps;
		},
	},
});
