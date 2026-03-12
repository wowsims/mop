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
import * as FuryInputs from './inputs';
import * as Presets from './presets';

const P2HitPostCapEPs = [0, 0];
const P3HitPostCapEPs = [0.42 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT, 0];

const SPEC_CONFIG = registerSpecConfig(Spec.SpecFuryWarrior, {
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
		statCaps: (() => {
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);
			return expCap;
		})(),
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
		epWeights: [Presets.P2_FURY_SMF_EP_PRESET, Presets.P2_FURY_TG_EP_PRESET, Presets.P3_FURY_TG_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.FurySMFTalents, Presets.FuryTGTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.FURY_DEFAULT_ROTATION],
		// Preset gear configurations that the user can quickly select.
		gear: [
			Presets.PRERAID_FURY_SMF_PRESET,
			Presets.PRERAID_FURY_TG_PRESET,
			Presets.P2_BIS_FURY_SMF_PRESET,
			Presets.P2_BIS_FURY_TG_PRESET,
			Presets.P3_BIS_FURY_TG_PRESET,
		],
		builds: [Presets.P2_PRESET_BUILD_SMF, Presets.P2_PRESET_BUILD_TG],
	},

	autoRotation: (_player: Player<Spec.SpecFuryWarrior>): APLRotation => {
		return Presets.FURY_DEFAULT_ROTATION.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecFuryWarrior,
			talents: Presets.FurySMFTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceWorgen,
				[Faction.Horde]: Race.RaceTroll,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P2_BIS_FURY_SMF_PRESET.gear,
					2: Presets.P2_BIS_FURY_TG_PRESET.gear,
					3: Presets.PRERAID_FURY_SMF_PRESET.gear,
					4: Presets.PRERAID_FURY_TG_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.P2_BIS_FURY_SMF_PRESET.gear,
					2: Presets.P2_BIS_FURY_TG_PRESET.gear,
					3: Presets.PRERAID_FURY_SMF_PRESET.gear,
					4: Presets.PRERAID_FURY_TG_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
});

export class FuryWarriorSimUI extends IndividualSimUI<Spec.SpecFuryWarrior> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecFuryWarrior>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			updateSoftCaps: softCaps => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);

				this.individualConfig.defaults.softCapBreakpoints!.forEach(softCap => {
					const softCapToModify = softCaps.find(sc => sc.unitStat.equals(softCap.unitStat));
					if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent) && softCapToModify) {
						if (avgIlvl >= 517) {
							softCapToModify.postCapEPs = P3HitPostCapEPs;
						} else {
							softCapToModify.postCapEPs = P2HitPostCapEPs;
						}
					}

					// TODO: Setup Crit soft cap for P3
					// if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent) && softCapToModify) {
					// 	if (avgIlvl >= 517) {
					// 		softCapToModify.postCapEPs = P3CritPostCapEPs;
					// 	} else {
					// 		softCapToModify.postCapEPs = P2CritPostCapEPs;
					// 	}
					// }
				});
				return softCaps;
			},
		});
	}
}
