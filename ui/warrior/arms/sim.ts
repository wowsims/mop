import { stat } from 'fs/promises';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Class, Debuffs, Faction, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import * as WarriorInputs from '../inputs';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecArmsWarrior, {
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
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

			return hitCap.add(expCap);
		})(),
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
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(Class.ClassWarrior),
			legacyOfTheEmperor: true,
			legacyOfTheWhiteTiger: true,
			darkIntent: true,
			trueshotAura: true,
			unleashedRage: true,
			moonkinAura: true,
			blessingOfMight: true,
			bloodlust: true,
		}),
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
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PREBIS_PRESET, Presets.P2_ARMS_BIS_PRESET, Presets.P3_4_ARMS_BIS_PRESET, Presets.P5_ARMS_BIS_PRESET],
	},

	autoRotation: (_player: Player<Spec.SpecArmsWarrior>): APLRotation => {
		return Presets.ROTATION_ARMS.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecArmsWarrior,
			talents: Presets.ArmsTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceWorgen,
				[Faction.Horde]: Race.RaceOrc,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P2_ARMS_BIS_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.P2_ARMS_BIS_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
});

export class ArmsWarriorSimUI extends IndividualSimUI<Spec.SpecArmsWarrior> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecArmsWarrior>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			getEPDefaults: player => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 560) {
					return Presets.P5_EP_PRESET.epWeights;
				} else if (avgIlvl >= 500) {
					return Presets.P2_EP_PRESET.epWeights;
				}
				return Presets.P1_EP_PRESET.epWeights;
			},
			updateSoftCaps: softCaps => {
				const gear = player.getGear();
				// const avgIlvl = gear.getAverageItemLevel(false);
				const hasT154P = gear.getItemSetCount('Battleplate of the Last Mogu') >= 4;
				const epWeights = this.reforger?.preCapEPs;

				if (epWeights) {
					softCaps.push(
						StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent, {
							breakpoints: [hasT154P ? 43 : 49],
							capType: StatCapType.TypeSoftCap,
							postCapEPs: [
								(epWeights.getStat(Stat.StatMasteryRating) * player.getTotalAmplificationTrinketStatModifier() - 0.02) *
									Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
							],
						}),
					);
				}

				return softCaps;
			},
		});
	}
}
