import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/view/other_inputs';

import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { APLRotation } from '../../core/proto/apl';
import { PseudoStat, Spec, Stat } from '../../core/proto/common';
// import * as DruidInputs from './inputs';
import * as DruidInputs from '../inputs';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecRestorationDruid, {
	cssClass: 'restoration-druid-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Druid),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMP5, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellPower,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatMana, Stat.StatStamina, Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatMP5, Stat.StatMasteryRating],
		[PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.P1_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_EP_PRESET.epWeights,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.CelestialFocusTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,

		partyBuffs: Presets.DefaultPartyBuffs,

		individualBuffs: Presets.DefaultIndividualBuffs,

		debuffs: Presets.DefaultDebuffs,

		other: Presets.OtherDefaults,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [DruidInputs.SelfInnervate()],
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
		talents: [Presets.CelestialFocusTalents, Presets.ThiccRestoTalents],
		rotations: [],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P1_PRESET, Presets.P2_PRESET, Presets.P3_PRESET, Presets.P4_PRESET],
	},

	autoRotation: (_player: Player<Spec.SpecRestorationDruid>): APLRotation => {
		return APLRotation.create();
	},
});

export class RestorationDruidSimUI extends IndividualSimUI<Spec.SpecRestorationDruid> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecRestorationDruid>) {
		super(parentElem, player, SPEC_CONFIG);
	}
}
