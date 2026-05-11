import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs.js';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics.js';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui.js';
import { Player } from '../../core/player.js';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation, APLRotation_Type } from '../../core/proto/apl.js';
import { Debuffs, IndividualBuffs, PartyBuffs, PseudoStat, RaidBuffs, Spec, Stat, UnitStats } from '../../core/proto/common.js';
import { StatCapType } from '../../core/proto/ui.js';
import { StatCap, Stats, UnitStat } from '../../core/proto_utils/stats.js';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import * as PaladinInputs from '../inputs.js';
import * as Presets from './presets.js';

const P2ExpertisePostCapEPs = [0.6, 0];
const P2OffensiveExpertisePostCapEPs = [0.42, 0];

const P3ExpertisePostCapEPs = [0.81, 0];
const P3OffensiveExpertisePostCapEPs = [0.91, 0];

const P5ExpertisePostCapEPs = [1.08, 0];
const P5OffensiveExpertisePostCapEPs = [1.21, 0];

const SPEC_CONFIG = registerSpecConfig(Spec.SpecProtectionPaladin, {
	cssClass: 'protection-paladin-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Paladin),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	overwriteDisplayStats: (player: Player<Spec.SpecProtectionPaladin>) => {
		const playerStats = player.getCurrentStats();

		const statMod = (current: UnitStats, previous?: UnitStats) => {
			return new Stats().withStat(Stat.StatSpellPower, Stats.fromProto(current).subtract(Stats.fromProto(previous)).getStat(Stat.StatAttackPower) * 0.5);
		};

		const base = statMod(playerStats.baseStats!);
		const gear = statMod(playerStats.gearStats!, playerStats.baseStats);
		const talents = statMod(playerStats.talentsStats!, playerStats.gearStats);
		const buffs = statMod(playerStats.buffsStats!, playerStats.talentsStats);
		const consumes = statMod(playerStats.consumesStats!, playerStats.buffsStats);
		const final = new Stats().withStat(Stat.StatSpellPower, Stats.fromProto(playerStats.finalStats).getStat(Stat.StatAttackPower) * 0.5);

		return {
			base: base,
			gear: gear,
			talents: talents,
			buffs: buffs,
			consumes: consumes,
			final: final,
			stats: [Stat.StatSpellPower],
		};
	},

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStamina,
		Stat.StatStrength,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatExpertiseRating,
		Stat.StatHasteRating,
		Stat.StatArmor,
		Stat.StatBonusArmor,
		Stat.StatDodgeRating,
		Stat.StatParryRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatArmor,
			Stat.StatBonusArmor,
			Stat.StatStamina,
			Stat.StatStrength,
			Stat.StatAgility,
			Stat.StatAttackPower,
			Stat.StatExpertiseRating,
			Stat.StatMasteryRating,
		],
		[
			PseudoStat.PseudoStatPhysicalHitPercent,
			PseudoStat.PseudoStatPhysicalCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHastePercent,
			PseudoStat.PseudoStatBlockPercent,
			PseudoStat.PseudoStatDodgePercent,
			PseudoStat.PseudoStatParryPercent,
		],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.P3_4_BALANCED_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		// Values for now are pre-Cata initial WAG
		epWeights: Presets.P3_4_BALANCED_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 15 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

			return hitCap.add(expCap);
		})(),
		softCapBreakpoints: (() => {
			return [
				StatCap.fromPseudoStat(PseudoStat.PseudoStatMeleeHastePercent, {
					breakpoints: [50],
					capType: StatCapType.TypeSoftCap,
					postCapEPs: [1.1 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
				}),
				StatCap.fromStat(Stat.StatExpertiseRating, {
					breakpoints: [7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION, 15 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION],
					capType: StatCapType.TypeSoftCap,
					postCapEPs: P2ExpertisePostCapEPs,
				}),
			];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		other: Presets.OtherDefaults,
		// Default raid/party buffs settings.
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(),
			arcaneBrilliance: true,
			blessingOfKings: true,
			blessingOfMight: true,
			bloodlust: true,
			elementalOath: true,
			powerWordFortitude: true,
			serpentsSwiftness: true,
			trueshotAura: true,
		}),
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			curseOfElements: true,
			physicalVulnerability: true,
			weakenedArmor: true,
			weakenedBlows: true,
		}),
		rotationType: APLRotation_Type.TypeAuto,
	},

	defaultBuild: Presets.PRESET_BUILD_DEFAULT,
	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [PaladinInputs.StartingSealSelection()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.SpellHasteBuff],
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
		talents: [Presets.DefaultTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.APL_SHA_PRESET, Presets.APL_HORRIDON_PRESET, Presets.APL_IRON_JUGGERNAUT_PRESET],
		// Preset gear configurations that the user can quickly select.
		gear: [
			Presets.P3_4_BALANCED_GEAR_PRESET,
			Presets.P3_4_OFFENSIVE_GEAR_PRESET,
			Presets.P5_PROG_GEAR_PRESET,
			Presets.P5_BALANCED_GEAR_PRESET,
			Presets.P5_OFFENSIVE_GEAR_PRESET,
		],
		builds: [Presets.P4_BALANCED_BUILD_PRESET, Presets.PRESET_BUILD_SHA, Presets.PRESET_BUILD_HORRIDON, Presets.PRESET_BUILD_IRON_JUGGERNAUT],
	},

	autoRotation: (_player: Player<Spec.SpecProtectionPaladin>): APLRotation => {
		return Presets.APL_HORRIDON_PRESET.rotation.rotation!;
	},

	raidSimPresets: [],
});

export class ProtectionPaladinSimUI extends IndividualSimUI<Spec.SpecProtectionPaladin> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecProtectionPaladin>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			getEPDefaults: player => {
				let epWeights = player.getEpWeights();

				const ampModifier = player.getTotalAmplificationTrinketStatModifier();
				epWeights = epWeights
					.withStat(Stat.StatHasteRating, epWeights.getStat(Stat.StatHasteRating) / ampModifier)
					.withStat(Stat.StatMasteryRating, epWeights.getStat(Stat.StatMasteryRating) / ampModifier);
				return epWeights;
			},
			updateSoftCaps: softCaps => {
				const epWeights = player.getEpWeights();

				this.individualConfig.defaults.softCapBreakpoints!.forEach(softCap => {
					const softCapToModify = softCaps.find(sc => sc.unitStat.equals(softCap.unitStat));
					if (softCap.unitStat.equalsStat(Stat.StatExpertiseRating) && softCapToModify) {
						if (epWeights.equals(Presets.P2_OFFENSIVE_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = P2OffensiveExpertisePostCapEPs;
						} else if (epWeights.equals(Presets.P3_4_OFFENSIVE_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = P3OffensiveExpertisePostCapEPs;
						} else if (epWeights.equals(Presets.P3_4_BALANCED_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = P3ExpertisePostCapEPs;
						} else if (epWeights.equals(Presets.P3_4_BALANCED_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = P3ExpertisePostCapEPs;
						} else if (epWeights.equals(Presets.P5_BALANCED_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = P5ExpertisePostCapEPs;
						} else if (epWeights.equals(Presets.P5_OFFENSIVE_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = P5OffensiveExpertisePostCapEPs;
						} else {
							softCapToModify.postCapEPs = P2ExpertisePostCapEPs;
						}
					}
					if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatMeleeHastePercent) && softCapToModify) {
						const raidBuffs = player.getRaid()?.getBuffs()!;
						const hasMeleeHaste = [
							raidBuffs.unholyAura,
							raidBuffs.cacklingHowl,
							raidBuffs.serpentsSwiftness,
							raidBuffs.swiftbladesCunning,
							raidBuffs.unleashedRage,
						].some(Boolean);

						let targetPercent = 50;
						if (hasMeleeHaste) {
							targetPercent += 15;
						}

						softCapToModify.breakpoints = [targetPercent];
						softCapToModify.postCapEPs = [
							((epWeights.getStat(Stat.StatCritRating) - 0.02) / player.getTotalAmplificationTrinketStatModifier()) *
								Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
						];
					}
				});

				return softCaps;
			},
		});
	}
}
