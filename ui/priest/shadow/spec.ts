import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import * as StatCaps from '@domain/presets/stat_caps';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '../../core/proto/common';
import * as PriestInputs from '../shared/inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecShadowPriest>({
	spec: Spec.SpecShadowPriest,

	cssClass: 'shadow-priest-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Priest),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [
		'Some items may display and use stats a litle higher than their original value.',
		'Procs from Weapons, Trinkets and other Items are not yet supported',
	],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatIntellect,
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
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,
	modifyDisplayStats: (player: Player<Spec.SpecShadowPriest>) => {
		const playerStats = player.getCurrentStats();
		const gearStats = Stats.fromProto(playerStats.gearStats);
		const talentsStats = Stats.fromProto(playerStats.talentsStats);
		const talentsDelta = talentsStats.subtract(gearStats);

		return {
			talents: new Stats().withStat(
				Stat.StatHitRating,
				talentsDelta.getPseudoStat(PseudoStat.PseudoStatSpellHitPercent) * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
			),
		};
	},

	defaults: {
		// Default equipped gear.
		gear: Presets.P3_4_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P3_4_EP_PRESET.epWeights,
		statCaps: StatCaps.spellHitCap(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.StandardTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,

		partyBuffs: PartyBuffs.create({}),

		individualBuffs: Presets.DefaultIndividualBuffs,

		debuffs: Presets.DefaultDebuffs,

		other: Presets.OtherDefaults,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [PriestInputs.ArmorInput()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.AttackSpeedBuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.ChannelClipDelay, OtherInputs.TankAssignment, OtherInputs.DistanceFromTarget],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.P1_EP_PRESET, Presets.P2_EP_PRESET, Presets.P3_4_EP_PRESET, Presets.P5_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.StandardTalents],
		rotations: [Presets.ROTATION_PRESET_DEFAULT],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRE_RAID_PRESET, Presets.P3_4_PRESET, Presets.P5_PRESET],
		itemSwaps: [],
		builds: [Presets.PRESET_BUILD_T15, Presets.PRESET_BUILD_T16],
	},

	autoRotation: (_: Player<Spec.SpecShadowPriest>): APLRotation => {
		return Presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
	},

	reforge: {
		statSelectionPresets: [Presets.SHADOW_BREAKPOINTS],
		getEPDefaults: player => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (avgIlvl >= 560) return Presets.P5_EP_PRESET.epWeights;
			if (avgIlvl >= 525) return Presets.P3_4_EP_PRESET.epWeights;
			if (avgIlvl >= 500) return Presets.P2_EP_PRESET.epWeights;
			return Presets.P1_EP_PRESET.epWeights;
		},
		updateSoftCaps: (softCaps, player) => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (avgIlvl >= 560) {
				const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
					breakpoints: [Presets.SHADOW_BREAKPOINTS.presets!.get('BL - 12-tick - DP')!],
					capType: StatCapType.TypeThreshold,
					postCapEPs: [(Presets.P5_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.02) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
				});
				softCaps.push(hasteSoftCapConfig);

				const masterySoftCapConfig = StatCap.fromStat(Stat.StatMasteryRating, {
					breakpoints: [UnitStat.fromStat(Stat.StatMasteryRating).convertPercentToRating(60)! / player.getMasteryPerPointModifier()],
					capType: StatCapType.TypeSoftCap,
					postCapEPs: [Presets.P5_EP_PRESET.epWeights.getStat(Stat.StatCritRating) - 0.02],
				});
				softCaps.push(masterySoftCapConfig);
			}

			return softCaps;
		},
	},
});
