import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics.js';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import * as HunterInputs from '../inputs';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecBeastMasteryHunter, {
	cssClass: 'beast-mastery-hunter-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Hunter),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
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
	itemSwapSlots: [
		ItemSlot.ItemSlotMainHand,
		ItemSlot.ItemSlotTrinket1,
		ItemSlot.ItemSlotTrinket2,
		ItemSlot.ItemSlotHead,
		ItemSlot.ItemSlotShoulder,
		ItemSlot.ItemSlotChest,
		ItemSlot.ItemSlotHands,
		ItemSlot.ItemSlotLegs,
	],
	defaults: {
		// Default equipped gear.
		gear: Presets.P4_PRESET_GEAR.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P4_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: Stats.fromMap(
			{
				[Stat.StatExpertiseRating]: 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION,
			},
			{
				[PseudoStat.PseudoStatPhysicalHitPercent]: 7.5,
			},
		),
		// Default breakpoint limits - set 19% haste as default target
		breakpointLimits: Stats.fromMap(
			{},
			{
				[PseudoStat.PseudoStatRangedHastePercent]: 19,
			},
		),
		softCapBreakpoints: [
			StatCap.fromPseudoStat(PseudoStat.PseudoStatRangedHastePercent, {
				breakpoints: [19, 20, 26, 33],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0.25, 0.2, 0.2, 0.2], // Single value that gets repeated for all breakpoints
			}),
		],

		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.BMDefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(),
			blessingOfKings: true,
			trueshotAura: true,
			leaderOfThePack: true,
			blessingOfMight: true,
			commandingShout: true,
			unholyAura: true,
			bloodlust: true,
		}),
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
		epWeights: [Presets.P4_EP_PRESET, Presets.P4_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DefaultTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_BM, Presets.ROTATION_PRESET_AOE],
		// Preset gear configurations that the user can quickly select.
		builds: [Presets.P4_PRESET],
		gear: [Presets.PRERAID_PRESET_GEAR, Presets.P4_PRESET_GEAR, Presets.P5_PRESET_GEAR],
	},

	autoRotation: (_: Player<Spec.SpecBeastMasteryHunter>): APLRotation => {
		return Presets.ROTATION_PRESET_BM.rotation.rotation!;
	},

	raidSimPresets: [],
});

export class BeastMasteryHunterSimUI extends IndividualSimUI<Spec.SpecBeastMasteryHunter> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecBeastMasteryHunter>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			updateSoftCaps: softCaps => {
				const hasteCap = softCaps.find(v => v.unitStat.equalsPseudoStat(PseudoStat.PseudoStatRangedHastePercent));
				if (hasteCap) {
					const hasteWeights = player.getEpWeights().getStat(Stat.StatHasteRating);
					const masteryWeights = player.getEpWeights().getStat(Stat.StatMasteryRating);
					const baseHasteEP = hasteWeights * Mechanics.HASTE_RATING_PER_HASTE_PERCENT;
					const baseMasteryEP = masteryWeights * Mechanics.HASTE_RATING_PER_HASTE_PERCENT;
					hasteCap.postCapEPs = [baseHasteEP, baseHasteEP, baseHasteEP, baseMasteryEP - 0.01 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT];
				}
				return softCaps;
			},
		});
	}
}
