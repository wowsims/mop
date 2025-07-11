import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics.js';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, Faction, HandType, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import { Sim } from '../../core/sim';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecWindwalkerMonk, {
	cssClass: 'windwalker-monk-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Monk),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatAgility,
		Stat.StatAttackPower,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatExpertiseRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps, PseudoStat.PseudoStatPhysicalHitPercent],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatAgility,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatStamina, Stat.StatStrength, Stat.StatAgility, Stat.StatAttackPower, Stat.StatExpertiseRating, Stat.StatMasteryRating],
		[
			PseudoStat.PseudoStatPhysicalHitPercent,
			PseudoStat.PseudoStatPhysicalCritPercent,
			PseudoStat.PseudoStatMeleeHastePercent,
			PseudoStat.PseudoStatSpellHitPercent,
			PseudoStat.PseudoStatSpellCritPercent,
			PseudoStat.PseudoStatSpellHastePercent,
		],
	),

	defaults: {
		// Default equipped gear.
		gear: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_PREBIS_DW_EP_PRESET.epWeights,
		// Stat caps for reforge optimizer
		statCaps: (() => {
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
			return expCap.add(hitCap);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatMeleeHastePercent, {
				breakpoints: [34.02, 43.5],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [
					(Presets.P1_PREBIS_DW_EP_PRESET.epWeights.getStat(Stat.StatCritRating) - 0.05) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
					(Presets.P1_PREBIS_DW_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.1) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
				],
			});
			const critSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent, {
				breakpoints: [58],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [(Presets.P1_PREBIS_DW_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.05) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			return [hasteSoftCapConfig, critSoftCapConfig];
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: RaidBuffs.create({
			...defaultRaidBuffMajorDamageCooldowns(),
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
	includeBuffDebuffInputs: [BuffDebuffInputs.CritBuff, BuffDebuffInputs.MajorArmorDebuff, BuffDebuffInputs.SpellHasteBuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InFrontOfTarget, OtherInputs.InputDelay],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P1_PREBIS_DW_EP_PRESET, Presets.P1_PREBIS_2H_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DefaultTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_PREBIS_DW_GEAR_PRESET, Presets.P1_PREBIS_2H_GEAR_PRESET, Presets.P1_BIS_DW_GEAR_PRESET, Presets.P1_BIS_2H_GEAR_PRESET],
	},

	autoRotation: (_: Player<Spec.SpecWindwalkerMonk>): APLRotation => {
		return Presets.ROTATION_PRESET.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecWindwalkerMonk,
			talents: Presets.DefaultTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceAlliancePandaren,
				[Faction.Horde]: Race.RaceHordePandaren,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
					2: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
					3: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
					4: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
					2: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
					3: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
					4: Presets.P1_PREBIS_DW_GEAR_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
});

const hasTwoHandMainHand = (player: Player<Spec.SpecWindwalkerMonk>): boolean =>
	player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item?.handType === HandType.HandTypeTwoHand;

const getActiveEPWeight = (player: Player<Spec.SpecWindwalkerMonk>, sim: Sim): Stats => {
	if (sim.getUseCustomEPValues()) {
		return player.getEpWeights();
	} else if (hasTwoHandMainHand(player)) {
		return Presets.P1_PREBIS_2H_EP_PRESET.epWeights;
	} else {
		return Presets.P1_PREBIS_DW_EP_PRESET.epWeights;
	}
};

export class WindwalkerMonkSimUI extends IndividualSimUI<Spec.SpecWindwalkerMonk> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecWindwalkerMonk>) {
		super(parentElem, player, SPEC_CONFIG);

		player.sim.waitForInit().then(() => {
			new ReforgeOptimizer(this, {
				getEPDefaults: (player: Player<Spec.SpecWindwalkerMonk>) => {
					return getActiveEPWeight(player, this.sim);
				},
				updateSoftCaps: (softCaps: StatCap[]) => {
					if (hasTwoHandMainHand(player)) {
						const hasteSoftCap = softCaps.find(v => v.unitStat.equalsPseudoStat(PseudoStat.PseudoStatMeleeHastePercent));
						if (hasteSoftCap) {
							// Two-Handed Windwalkers need to adjust for Way of the Monk 40% Melee Haste
							hasteSoftCap.breakpoints = hasteSoftCap.breakpoints.map(v => v + 40);
						}
					}
					return softCaps;
				},
			});
		});
	}
}
