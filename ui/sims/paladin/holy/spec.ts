import { APLRotation } from '@core/proto/apl';
import { IndividualBuffs, PartyBuffs, PseudoStat, Spec, Stat } from '@core/proto/common';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/model/other_inputs';
import { defineSpec } from '@features/spec_config';

import * as HolyInputs from './inputs';
import * as Presets from './presets';

export default defineSpec<Spec.SpecHolyPaladin>({
	spec: Spec.SpecHolyPaladin,

	cssClass: 'holy-paladin-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Paladin),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatHasteRating, Stat.StatCritRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellPower,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatMana, Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatMasteryRating, Stat.StatArmor, Stat.StatStamina],
		[PseudoStat.PseudoStatSpellHastePercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHitPercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.P1_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_EP_PRESET.epWeights,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.StandardTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		other: Presets.OtherDefaults,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: PartyBuffs.create({}),

		individualBuffs: IndividualBuffs.create({}),
		debuffs: Presets.DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [],
	// Inputs to include in the 'Rotation' section on the settings tab.
	rotationInputs: HolyInputs.PaladinRotationConfig,
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.TankAssignment],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P1_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.StandardTalents],
		rotations: [],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_GEAR_PRESET],
	},

	autoRotation: (_player: Player<Spec.SpecHolyPaladin>): APLRotation => {
		return APLRotation.create();
	},
});
