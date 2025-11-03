import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Faction, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { DEFAULT_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { DefaultDebuffs, DefaultRaidBuffs, MAGE_BREAKPOINTS } from '../presets';
import * as FrostInputs from './inputs';
import * as Presets from './presets';
import * as MageInputs from '../inputs';

const mageBombBreakpoints = MAGE_BREAKPOINTS.presets;
const livingBombBreakpoints = [
	mageBombBreakpoints.get('6-tick - Living Bomb')!,
	mageBombBreakpoints.get('7-tick - Living Bomb')!,
	mageBombBreakpoints.get('8-tick - Living Bomb')!,
];
const netherTempestBreakpoints = [
	mageBombBreakpoints.get('15-tick - Nether Tempest')!,
	mageBombBreakpoints.get('16-tick - Nether Tempest')!,
	mageBombBreakpoints.get('17-tick - Nether Tempest')!,
	mageBombBreakpoints.get('18-tick - Nether Tempest')!,
	mageBombBreakpoints.get('19-tick - Nether Tempest')!,
	mageBombBreakpoints.get('20-tick - Nether Tempest')!,
	mageBombBreakpoints.get('21-tick - Nether Tempest')!,
	mageBombBreakpoints.get('22-tick - Nether Tempest')!,
	mageBombBreakpoints.get('23-tick - Nether Tempest')!,
];

const SPEC_CONFIG = registerSpecConfig(Spec.SpecFrostMage, {
	cssClass: 'frost-mage-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Mage),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellPower,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatStamina,
			Stat.StatIntellect,
			Stat.StatSpirit,
			Stat.StatSpellPower,
			Stat.StatMasteryRating,
			Stat.StatExpertiseRating,
		],
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.P2_BIS.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_BIS_EP_PRESET.epWeights,
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: livingBombBreakpoints,
				capType: StatCapType.TypeThreshold,
				postCapEPs: [(Presets.P1_BIS_EP_PRESET.epWeights.getStat(Stat.StatCritRating) - 0.01) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			const critSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellCritPercent, {
				breakpoints: [28],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [(Presets.P1_BIS_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) / 2) * Mechanics.CRIT_RATING_PER_CRIT_PERCENT],
			});

			return [critSoftCapConfig, hasteSoftCapConfig];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.FrostDefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultFrostOptions,
		other: Presets.OtherDefaults,
		// Default raid/party buffs settings.
		raidBuffs: DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [MageInputs.MageArmorInputs()],
	// Inputs to include in the 'Rotation' section on the settings tab.
	rotationInputs: FrostInputs.MageRotationConfig,
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [
		//Should add hymn of hope, revitalize, and
	],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [
			//FrostInputs.WaterElementalDisobeyChance,
			OtherInputs.InputDelay,
			OtherInputs.DistanceFromTarget,
			OtherInputs.TankAssignment,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.P1_PREBIS_EP_PRESET, Presets.P1_BIS_EP_PRESET, Presets.P3_BIS_EP_PRESET],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_DEFAULT, Presets.ROTATION_PRESET_AOE],
		// Preset talents that the user can quickly select.
		talents: [Presets.FrostDefaultTalents, Presets.FrostTalentsCleave, Presets.FrostTalentsAoE],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_PREBIS, Presets.P1_BIS, Presets.P2_BIS, Presets.P3_BIS],

		builds: [Presets.P1_PRESET_BUILD_DEFAULT, Presets.P1_PRESET_BUILD_CLEAVE, Presets.P1_PRESET_BUILD_AOE],
	},

	autoRotation: (player: Player<Spec.SpecFrostMage>): APLRotation => {
		const numTargets = player.sim.encounter.targets.length;
		if (numTargets >= 5) {
			return Presets.ROTATION_PRESET_AOE.rotation.rotation!;
			// } else if (numTargets >= 2) {
			// 	return Presets.ROTATION_PRESET_CLEAVE.rotation.rotation!;
		} else {
			return Presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
		}
	},

	raidSimPresets: [
		{
			spec: Spec.SpecFrostMage,
			talents: Presets.FrostDefaultTalents.data,
			specOptions: Presets.DefaultFrostOptions,
			consumables: Presets.DefaultConsumables,
			otherDefaults: Presets.OtherDefaults,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceAlliancePandaren,
				[Faction.Horde]: Race.RaceOrc,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P1_PREBIS.gear,
				},
				[Faction.Horde]: {
					1: Presets.P1_PREBIS.gear,
				},
			},
		},
	],
});

export class FrostMageSimUI extends IndividualSimUI<Spec.SpecFrostMage> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecFrostMage>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			statSelectionPresets: [MAGE_BREAKPOINTS],
			enableBreakpointLimits: true,
			getEPDefaults: player => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 517) {
					return Presets.P3_BIS_EP_PRESET.epWeights;
				} else if (avgIlvl >= 500) {
					return Presets.P1_BIS_EP_PRESET.epWeights;
				}
				return Presets.P1_PREBIS_EP_PRESET.epWeights;
			},
			updateSoftCaps: softCaps => {
				this.individualConfig.defaults.softCapBreakpoints!.forEach(softCap => {
					const softCapToModify = softCaps.find(sc => sc.unitStat.equals(softCap.unitStat));
					if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent) && softCapToModify) {
						const talents = player.getTalents();
						if (talents.livingBomb) {
							softCapToModify.breakpoints = livingBombBreakpoints;
						} else if (talents.netherTempest) {
							softCapToModify.breakpoints = netherTempestBreakpoints;
						}
					}
				});
				return softCaps;
			},
		});
	}
}
