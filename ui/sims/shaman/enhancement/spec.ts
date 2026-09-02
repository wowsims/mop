import { APLRotation } from '@core/proto/apl';
import { IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Spec, Stat, UnitStats } from '@core/proto/common';
import * as Mechanics from '@domain/constants/mechanics';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { Stats, UnitStat } from '@domain/proto_utils/stats';
import { subscribeAll, subscribePlayerField } from '@domain/state/subscriptions';
import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';
import i18n from '@i18n/config';

import * as ShamanInputs from '../shared/inputs';
import * as EnhancementInputs from './inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecEnhancementShaman>({
	spec: Spec.SpecEnhancementShaman,

	cssClass: 'enhancement-shaman-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Shaman),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	warnings: [
		simUI => {
			return {
				updateOn: subscribeAll([subscribePlayerField(simUI.player, 'specOptions'), subscribePlayerField(simUI.player, 'talentsString')]),
				getContent: () => {
					const autocast = simUI.player.getClassOptions().feleAutocast;
					if (
						simUI.player.getTalents().primalElementalist &&
						(autocast?.autocastEmpower || !(autocast?.autocastFireblast && autocast.autocastFirenova && autocast.autocastImmolate))
					) {
						return i18n.t('sidebar.warnings.shaman_fele_autocast');
					} else {
						return '';
					}
				},
			};
		},
	],

	overwriteDisplayStats: (player: Player<Spec.SpecEnhancementShaman>) => {
		const playerStats = player.getCurrentStats();

		const statMod = (current: UnitStats, previous?: UnitStats) => {
			return new Stats().withStat(Stat.StatSpellPower, Stats.fromProto(current).subtract(Stats.fromProto(previous)).getStat(Stat.StatAttackPower) * 0.65);
		};

		const base = statMod(playerStats.baseStats!);
		const gear = statMod(playerStats.gearStats!, playerStats.baseStats);
		const talents = statMod(playerStats.talentsStats!, playerStats.gearStats);
		const buffs = statMod(playerStats.buffsStats!, playerStats.talentsStats);
		const consumes = statMod(playerStats.consumesStats!, playerStats.buffsStats);
		const final = new Stats().withStat(Stat.StatSpellPower, Stats.fromProto(playerStats.finalStats).getStat(Stat.StatAttackPower) * 0.65);

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
		Stat.StatAgility,
		Stat.StatIntellect,
		Stat.StatAttackPower,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatExpertiseRating,
		Stat.StatMasteryRating,
	],
	epPseudoStats: [
		PseudoStat.PseudoStatMainHandDps,
		PseudoStat.PseudoStatOffHandDps,
		PseudoStat.PseudoStatPhysicalHitPercent,
		PseudoStat.PseudoStatSpellHitPercent,
	],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatAgility,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatStamina,
			Stat.StatStrength,
			Stat.StatAgility,
			Stat.StatIntellect,
			Stat.StatAttackPower,
			Stat.StatExpertiseRating,
			Stat.StatSpellPower,
			Stat.StatMasteryRating,
		],
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
		gear: Presets.P5_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P3_EP_PRESET.epWeights,
		// Default stat caps for the Reforge optimizer
		statCaps: (() => {
			const physHitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatPhysicalHitPercent, 7.5);
			const spellHitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
			const expCap = new Stats().withStat(Stat.StatExpertiseRating, 7.5 * 4 * Mechanics.EXPERTISE_PER_QUARTER_PERCENT_REDUCTION);

			return physHitCap.add(spellHitCap.add(expCap));
		})(),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.P3Talents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Presets.DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [
		ShamanInputs.ShamanShieldInput(),
		ShamanInputs.ShamanImbueMH(),
		EnhancementInputs.ShamanImbueOH,
		ShamanInputs.ShamanImbueMHSwap(),
		EnhancementInputs.ShamanImbueOHSwap,
	],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [BuffDebuffInputs.SpellPowerBuff],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [EnhancementInputs.SyncTypeInput, OtherInputs.InputDelay, OtherInputs.TankAssignment, OtherInputs.InFrontOfTarget],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	sections: [ShamanInputs.enhancementTotemsSection()],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P1_EP_PRESET, Presets.P3_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.P3Talents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_P3],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_GEAR_PRESET, Presets.P2_GEAR_PRESET, Presets.P4_GEAR_PRESET, Presets.P5_GEAR_PRESET],
	},

	autoRotation: (_: Player<Spec.SpecEnhancementShaman>): APLRotation => {
		return Presets.ROTATION_PRESET_P3.rotation.rotation!;
	},

	reforge: {
		getEPDefaults: player => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (avgIlvl >= 522) {
				return Presets.P3_EP_PRESET.epWeights;
			}
			return Presets.P1_EP_PRESET.epWeights;
		},
	},
});
