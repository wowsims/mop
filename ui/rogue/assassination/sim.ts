import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';
import { nextEventID } from '@domain/state/batch';
import { subscribeEncounterChange, subscribePlayerChange } from '@domain/state/subscriptions';
import { ReforgeOptimizer } from '@features/reforge/view/reforge_panel';

import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { RogueOptions_PoisonOptions } from '../../core/proto/rogue';
import * as RogueInputs from '../inputs';
import * as Presets from './presets';
const SPEC_CONFIG = registerSpecConfig(Spec.SpecAssassinationRogue, {
	cssClass: 'assassination-rogue-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Rogue),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatAgility, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating, Stat.StatExpertiseRating],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatAgility,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatStamina, Stat.StatAgility, Stat.StatStrength, Stat.StatAttackPower, Stat.StatMasteryRating, Stat.StatExpertiseRating],
		[PseudoStat.PseudoStatPhysicalHitPercent, PseudoStat.PseudoStatPhysicalCritPercent, PseudoStat.PseudoStatMeleeHastePercent],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.P5_GEARSET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.ASN_EP_PRESET.epWeights,
		// Stat caps for reforge optimizer
		statCaps: (() => {
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);
			return expCap;
		})(),
		softCapBreakpoints: (() => {
			const meleeHitSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, {
				breakpoints: [7.5, 26.5],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0.21 * Mechanics.PHYSICAL_HIT_RATING_PER_HIT_PERCENT, 0],
			});

			return [meleeHitSoftCapConfig];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.AssassinationTalentsDefault.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(),
			blessingOfKings: true,
			trueshotAura: true,
			swiftbladesCunning: true,
			legacyOfTheWhiteTiger: true,
			blessingOfMight: true,
			bloodlust: true,
		}),
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({
			weakenedArmor: true,
			physicalVulnerability: true,
			masterPoisoner: true,
		}),
	},

	playerInputs: {
		inputs: [RogueInputs.ApplyPoisonsManually()],
	},
	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [RogueInputs.LethalPoison()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [
		BuffDebuffInputs.CritBuff,
		BuffDebuffInputs.AttackPowerBuff,
		BuffDebuffInputs.MasteryBuff,
		BuffDebuffInputs.StatsBuff,
		BuffDebuffInputs.AttackSpeedBuff,

		BuffDebuffInputs.MajorHasteBuff,
		BuffDebuffInputs.StormLashTotem,
		BuffDebuffInputs.Skullbanner,
		BuffDebuffInputs.ShatteringThrow,
		BuffDebuffInputs.TricksOfTheTrade,
		BuffDebuffInputs.UnholyFrenzy,

		BuffDebuffInputs.SpellDamageDebuff,
		BuffDebuffInputs.MajorArmorDebuff,
		BuffDebuffInputs.PhysicalDamageDebuff,
	],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InFrontOfTarget, OtherInputs.InputDelay],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.ASN_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.AssassinationTalentsDefault],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_ASSASSINATION],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_GEARSET, Presets.P2_GEARSET, Presets.P3_GEARSET, Presets.P5_GEARSET],
	},

	autoRotation: (player: Player<Spec.SpecAssassinationRogue>): APLRotation => {
		const numTargets = player.sim.encounter.getTargets().length;
		if (numTargets >= 5) {
			return Presets.ROTATION_PRESET_ASSASSINATION.rotation.rotation!;
		} else {
			return Presets.ROTATION_PRESET_ASSASSINATION.rotation.rotation!;
		}
	},
});

export class AssassinationRogueSimUI extends IndividualSimUI<Spec.SpecAssassinationRogue> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecAssassinationRogue>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this);

		// Poison selection
		subscribePlayerChange(this.player)(() => {
			const c = nextEventID();
			const options = this.player.getSpecOptions();
			if (!options.classOptions!.applyPoisonsManually) {
				options.classOptions!.lethalPoison = RogueOptions_PoisonOptions.DeadlyPoison;
			}
			this.player.setSpecOptions(c, options);
		});
		subscribeEncounterChange(this.sim.encounter)(() => {
			const c = nextEventID();
			const options = this.player.getSpecOptions();
			if (!options.classOptions!.applyPoisonsManually) {
				options.classOptions!.lethalPoison = RogueOptions_PoisonOptions.DeadlyPoison;
			}
			this.player.setSpecOptions(c, options);
		});
	}
}
