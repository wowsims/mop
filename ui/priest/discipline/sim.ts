import { IndividualSimUI, registerSpecConfig } from '@app/individual_sim_ui';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/view/other_inputs';

import { APLRotation } from '../../core/proto/apl';
import { PartyBuffs, PseudoStat, Spec, Stat } from '../../core/proto/common';
import * as PriestInputs from '../inputs';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecDisciplinePriest, {
	cssClass: 'discipline-priest-sim-ui',
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
	// modifyDisplayStats: (player: Player<Spec.SpecDisciplinePriest>) => {
	// 	let stats = new Stats();
	// 	stats = stats.addStat(Stat.StatSpellHit, player.getTalents().shadowFocus * 1 * Mechanics.SPELL_HIT_RATING_PER_HIT_CHANCE);

	// 	return {
	// 		talents: stats,
	// 	};
	// },

	defaults: {
		// Default equipped gear.
		gear: Presets.P1_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_EP_PRESET.epWeights,
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
		epWeights: [Presets.P1_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.StandardTalents, Presets.EnlightenmentTalents],
		rotations: [Presets.ROTATION_PRESET_DEFAULT],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_PRESET],
	},

	autoRotation: (player: Player<Spec.SpecDisciplinePriest>): APLRotation => {
		return Presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
	},
});

export class DisciplinePriestSimUI extends IndividualSimUI<Spec.SpecDisciplinePriest> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecDisciplinePriest>) {
		super(parentElem, player, SPEC_CONFIG);
	}
}
