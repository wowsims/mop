import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { DEFAULT_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '../../core/proto/common';
import * as MageInputs from '../inputs';
import { DefaultDebuffs, DefaultRaidBuffs, MAGE_BREAKPOINTS } from '../presets';
import * as FrostInputs from './inputs';
import * as Presets from './presets';

const mageBombBreakpoints = MAGE_BREAKPOINTS.presets;
const livingBombBreakpoints = [
	mageBombBreakpoints.get('6-tick - Living Bomb')!,
	mageBombBreakpoints.get('7-tick - Living Bomb')!,
	mageBombBreakpoints.get('8-tick - Living Bomb')!,
];
const gcdCapBreakpoint = mageBombBreakpoints.get('GCD Soft Cap')!;
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

const P2CritPostCapEPs = [
	0.56 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
	0.45 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
	0.35 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
];
const P2HastePostCapEP = 0.46 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT;

const P3CritPostCapEPs = [
	0.51 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
	0.44 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
	0.38 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
];
const P3HastePostCapEP = 0.48 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT;

const P5CritPostCapEPs = [
	0.76 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
	0.68 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
	0.57 * Mechanics.CRIT_RATING_PER_CRIT_PERCENT,
];
const P5HastePostCapEP = 0.72 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT;
const P5HastePostGCDCapEP = 0.52 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT;

export default defineSpec<Spec.SpecFrostMage>({
	spec: Spec.SpecFrostMage,

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
		gear: Presets.P5_BIS.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P5_BIS_EP_PRESET.epWeights,
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteSoftCapBreakpoints = [...livingBombBreakpoints, gcdCapBreakpoint].sort((a, b) => a - b);
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: hasteSoftCapBreakpoints,
				capType: StatCapType.TypeSoftCap,
				// Once the GCD soft cap is passed, the residual value of haste drops, so use the lower post-GCD EP.
				postCapEPs: hasteSoftCapBreakpoints.map(breakpoint => (breakpoint >= gcdCapBreakpoint ? P5HastePostGCDCapEP : P5HastePostCapEP)),
			});

			const critSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellCritPercent, {
				breakpoints: [23, 26, 28],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: P2CritPostCapEPs,
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
		epWeights: [Presets.P1_PREBIS_EP_PRESET, Presets.P1_BIS_EP_PRESET, Presets.P3_BIS_EP_PRESET, Presets.P5_BIS_EP_PRESET],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_DEFAULT, Presets.ROTATION_PRESET_AOE],
		// Preset talents that the user can quickly select.
		talents: [Presets.FrostDefaultTalents, Presets.FrostTalentsCleave, Presets.FrostTalentsAoE],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_PREBIS, Presets.P1_BIS, Presets.P2_BIS, Presets.P3_BIS, Presets.P4_BIS, Presets.P5_BIS],

		builds: [Presets.P1_PRESET_BUILD_DEFAULT, Presets.P1_PRESET_BUILD_CLEAVE, Presets.P1_PRESET_BUILD_AOE, Presets.T16_PRESET_BUILD],
	},

	autoRotation: (player: Player<Spec.SpecFrostMage>): APLRotation => {
		const numTargets = player.sim.encounter.getTargets().length;
		if (numTargets >= 5) {
			return Presets.ROTATION_PRESET_AOE.rotation.rotation!;
			// } else if (numTargets >= 2) {
			// 	return Presets.ROTATION_PRESET_CLEAVE.rotation.rotation!;
		} else {
			return Presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
		}
	},

	reforge: {
		statSelectionPresets: [MAGE_BREAKPOINTS],
		enableBreakpointLimits: true,
		getEPDefaults: player => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (avgIlvl >= 560) return Presets.P5_BIS_EP_PRESET.epWeights;
			if (avgIlvl >= 517) return Presets.P3_BIS_EP_PRESET.epWeights;
			if (avgIlvl >= 500) return Presets.P1_BIS_EP_PRESET.epWeights;
			return Presets.P1_PREBIS_EP_PRESET.epWeights;
		},
		updateSoftCaps: (softCaps, player: Player<Spec.SpecFrostMage>) => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);

			const hasteSoftCap = softCaps.find(sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent));
			if (hasteSoftCap) {
				const talents = player.getTalents();

				let talentBreakpoints: number[] = [];
				if (talents.livingBomb) {
					talentBreakpoints = livingBombBreakpoints;
				} else if (talents.netherTempest) {
					talentBreakpoints = netherTempestBreakpoints;
				}

				let postCapEP: number;
				let postGCDCapEP: number;
				if (avgIlvl >= 560) {
					postCapEP = P5HastePostCapEP;
					postGCDCapEP = P5HastePostGCDCapEP;
				} else if (avgIlvl >= 517) {
					postCapEP = P3HastePostCapEP;
					postGCDCapEP = P3HastePostCapEP;
				} else {
					postCapEP = P2HastePostCapEP;
					postGCDCapEP = P2HastePostCapEP;
				}

				const breakpoints = [...talentBreakpoints, gcdCapBreakpoint].sort((a, b) => a - b);
				hasteSoftCap.breakpoints = breakpoints;
				// Once the GCD soft cap is passed, the residual value of haste drops, so use the lower post-GCD EP.
				hasteSoftCap.postCapEPs = breakpoints.map(breakpoint => (breakpoint >= gcdCapBreakpoint ? postGCDCapEP : postCapEP));
			}

			const critSoftCap = softCaps.find(sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellCritPercent));
			if (critSoftCap) {
				if (avgIlvl >= 560) {
					critSoftCap.postCapEPs = P5CritPostCapEPs;
				} else if (avgIlvl >= 517) {
					critSoftCap.postCapEPs = P3CritPostCapEPs;
				} else {
					critSoftCap.postCapEPs = P2CritPostCapEPs;
				}
			}

			return softCaps;
		},
	},
});
