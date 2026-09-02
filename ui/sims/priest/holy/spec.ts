import { APLRotation } from '@core/proto/apl';
import { PartyBuffs, PseudoStat, Spec, Stat } from '@core/proto/common';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/view/other_inputs';
import { defineSpec } from '@features/spec_config';

import * as PriestInputs from '../shared/inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecHolyPriest>({
	spec: Spec.SpecHolyPriest,

	cssClass: 'holy-priest-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Priest),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [
		Stat.StatIntellect,
		Stat.StatSpirit,
		Stat.StatSpellPower,
		Stat.StatHitRating,
		Stat.StatCritRating,
		Stat.StatHasteRating,
		Stat.StatMP5,
		Stat.StatMasteryRating,
	],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellPower,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatMana, Stat.StatStamina, Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatMP5, Stat.StatMasteryRating],
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,
	// modifyDisplayStats: (player: Player<Spec.SpecHolyPriest>) => {
	// 	let stats = new Stats();
	// 	stats = stats.addStat(Stat.StatSpellHit, player.getTalents().shadowFocus * 1 * Mechanics.SPELL_HIT_RATING_PER_HIT_CHANCE);

	// 	return {
	// 		talents: stats,
	// 	};
	// },

	defaults: {
		// Default equipped gear.
		gear: Presets.P4_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_EP_WEIGHTS.epWeights,
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
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.TankAssignment, OtherInputs.ChannelClipDelay],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P1_EP_WEIGHTS],
		// Preset talents that the user can quickly select.
		talents: [Presets.StandardTalents, Presets.EnlightenmentTalents],
		rotations: [Presets.ROTATION_PRESET_DEFAULT, Presets.ROTATION_PRESET_AOE24, Presets.ROTATION_PRESET_AOE4PLUS],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P1_PRESET, Presets.P2_PRESET, Presets.P3_PRESET, Presets.P4_PRESET],
	},

	autoRotation: (player: Player<Spec.SpecHolyPriest>): APLRotation => {
		const numTargets = player.sim.encounter.getTargets().length;
		if (numTargets > 4) {
			return Presets.ROTATION_PRESET_AOE4PLUS.rotation.rotation!;
		} else if (numTargets > 1) {
			return Presets.ROTATION_PRESET_AOE24.rotation.rotation!;
		} else {
			return Presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
		}
	},
});
