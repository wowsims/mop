import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation, APLRotation_Type } from '../../core/proto/apl.js';
import { Debuffs, Faction, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import * as Presets from './presets';

const ExpertiseBreakpoints = [0.53, 0];
const OffensiveExpertiseBreakpoints = [0.68, 0];

const SPEC_CONFIG = registerSpecConfig(Spec.SpecBloodDeathKnight, {
	cssClass: 'blood-death-knight-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.DeathKnight),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatStamina,
		Stat.StatStrength,
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatExpertiseRating,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatHealth,
		Stat.StatArmor,
		Stat.StatBonusArmor,
		Stat.StatDodgeRating,
		Stat.StatParryRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatStrength,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatArmor,
			Stat.StatStamina,
			Stat.StatStrength,
			Stat.StatAgility,
			Stat.StatAttackPower,
			Stat.StatExpertiseRating,
			Stat.StatMasteryRating,
		],
		[
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHastePercent,
			PseudoStat.PseudoStatPhysicalHitPercent,
			PseudoStat.PseudoStatPhysicalCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
			PseudoStat.PseudoStatDodgePercent,
			PseudoStat.PseudoStatParryPercent,
		],
	),
	defaults: {
		// Default equipped gear.
		gear: Presets.P3_4_BALANCED_BLOOD_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P3_4_BALANCED_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 15 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

			return hitCap.add(expCap);
		})(),
		softCapBreakpoints: (() => {
			return [
				StatCap.fromStat(Stat.StatExpertiseRating, {
					breakpoints: [7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION, 15 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION],
					capType: StatCapType.TypeSoftCap,
					postCapEPs: ExpertiseBreakpoints,
				}),
			];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.BloodTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(),
			blessingOfKings: true,
			blessingOfMight: true,
			bloodlust: true,
			elementalOath: true,
			leaderOfThePack: true,
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

	// modifyDisplayStats: (player: Player<Spec.SpecBloodDeathKnight>) => {
	// },

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.SpellDamageDebuff, BuffDebuffInputs.SpellHasteBuff],
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
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [
			Presets.P3_4_SURVIVAL_EP_PRESET,
			Presets.P3_4_BALANCED_EP_PRESET,
			Presets.P3_4_OFFENSIVE_EP_PRESET,
			Presets.P5_SURVIVAL_EP_PRESET,
			Presets.P5_BALANCED_EP_PRESET,
			Presets.P5_OFFENSIVE_EP_PRESET,
		],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.BLOOD_ROTATION_PRESET_SHA, Presets.BLOOD_ROTATION_PRESET_HORRIDON, Presets.BLOOD_ROTATION_PRESET_IRON_JUGGERNAUT],
		// Preset talents that the user can quickly select.
		talents: [Presets.BloodTalents],
		// Preset gear configurations that the user can quickly select.
		gear: [
			Presets.P3_4_PROG_BLOOD_PRESET,
			Presets.P3_4_BALANCED_BLOOD_PRESET,
			Presets.P3_4_OFFENSIVE_BLOOD_PRESET,
			Presets.P5_PROG_BLOOD_PRESET,
			Presets.P5_BALANCED_BLOOD_PRESET,
			Presets.P5_OFFENSIVE_BLOOD_PRESET,
		],
		builds: [Presets.PRESET_BUILD_SHA, Presets.PRESET_BUILD_HORRIDON, Presets.PRESET_BUILD_IRON_JUGGERNAUT],
	},

	autoRotation: (_player: Player<Spec.SpecBloodDeathKnight>): APLRotation => {
		return Presets.BLOOD_ROTATION_PRESET_HORRIDON.rotation.rotation!;
	},

	raidSimPresets: [],
});

export class BloodDeathKnightSimUI extends IndividualSimUI<Spec.SpecBloodDeathKnight> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecBloodDeathKnight>) {
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
						if (epWeights.equals(Presets.P3_4_OFFENSIVE_EP_PRESET.epWeights) || epWeights.equals(Presets.P5_OFFENSIVE_EP_PRESET.epWeights)) {
							softCapToModify.postCapEPs = OffensiveExpertiseBreakpoints;
						} else {
							softCapToModify.postCapEPs = ExpertiseBreakpoints;
						}
					}
				});
				return softCaps;
			},
		});
	}
}
