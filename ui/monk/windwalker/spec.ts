import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '@domain/proto_utils/utils';
import { RelativeStatCap } from '@domain/reforge_settings';
import { nextEventID } from '@domain/state/batch';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, HandType, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { talentBasedSettingsRule } from '../shared/derived';
import * as Presets from './presets';

const hasTwoHandMainHand = (player: Player<Spec.SpecWindwalkerMonk>): boolean =>
	player.getEquippedItem(ItemSlot.ItemSlotMainHand)?.item?.handType === HandType.HandTypeTwoHand;

export default defineSpec<Spec.SpecWindwalkerMonk>({
	spec: Spec.SpecWindwalkerMonk,

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
	epPseudoStats: [PseudoStat.PseudoStatMainHandDps, PseudoStat.PseudoStatOffHandDps],
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
		gear: Presets.P5_BIS_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_BIS_EP_PRESET.epWeights,
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
					(Presets.P1_BIS_EP_PRESET.epWeights.getStat(Stat.StatCritRating) - 0.05) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
					(Presets.P1_BIS_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.1) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
				],
			});
			const critSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatPhysicalCritPercent, {
				breakpoints: [58],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [(Presets.P1_BIS_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.05) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
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
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P1_BIS_EP_PRESET, Presets.RORO_P3_4_EP_PRESET, Presets.RORO_P5_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DefaultTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PREBIS_GEAR_PRESET, Presets.P2_BIS_GEAR_PRESET, Presets.P3_4_BIS_GEAR_PRESET, Presets.P3_4_BIS_GEAR_PRESET, Presets.P5_BIS_GEAR_PRESET],
		builds: [Presets.P2_BUILD_PRESET, Presets.P3_4_BUILD_PRESET, Presets.P5_BUILD_PRESET],
	},

	autoRotation: (_: Player<Spec.SpecWindwalkerMonk>): APLRotation => {
		return Presets.ROTATION_PRESET.rotation.rotation!;
	},

	// `host.reforger` is still null while this runs (the sim UI assigns it only
	// once the optimizer is constructed), exactly as the old `this.reforger?.` in
	// the spec constructor was — the callbacks below run later, when it is set.
	reforge: host => ({
		defaultRelativeStatCap: Stat.StatMasteryRating,
		getEPDefaults: (player: Player<Spec.SpecWindwalkerMonk>) => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (RelativeStatCap.hasRoRo(player)) {
				host.reforger?.setUseSoftCapBreakpoints(nextEventID(), false);
				if (avgIlvl >= 560) {
					return Presets.RORO_P5_EP_PRESET.epWeights;
				} else {
					return Presets.RORO_P3_4_EP_PRESET.epWeights;
				}
			}
			return Presets.P1_BIS_EP_PRESET.epWeights;
		},
		updateSoftCaps: (softCaps: StatCap[], player: Player<Spec.SpecWindwalkerMonk>) => {
			if (RelativeStatCap.hasRoRo(player)) {
				return [];
			}
			if (hasTwoHandMainHand(player)) {
				const hasteSoftCap = softCaps.find(v => v.unitStat.equalsPseudoStat(PseudoStat.PseudoStatMeleeHastePercent));
				if (hasteSoftCap) {
					// Two-Handed Windwalkers need to adjust for Way of the Monk 40% Melee Haste
					hasteSoftCap.breakpoints = hasteSoftCap.breakpoints.map(v => v + 40);
				}
			}
			return softCaps;
		},
	}),
	derivedSettings: [talentBasedSettingsRule],
});
