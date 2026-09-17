import * as BuffDebuffInputs from '@features/settings/model/buffs_debuffs';
import { StatCapType } from '@generated/proto/api';
import { APLRotation } from '@generated/proto/apl';
import { Debuffs, IndividualBuffs, PartyBuffs, PseudoStat, Spec, Stat } from '@generated/proto/common';
import * as Mechanics from '@sim/constants/mechanics';
import { PlayerClasses } from '@sim/player/classes';
import { Player } from '@sim/player/player';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '@sim/proto/stats';
import { defaultHealerRaidBuffs } from '@sim/proto/utils';
import { defineSpec } from '@sim/spec_config';

import * as PriestInputs from '../shared/inputs';
import * as Presets from './presets';

const hasteBreakpoints = Presets.HOLY_BREAKPOINTS.find(entry => entry.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent))!.presets!;

// Gear planner only: no healing spells are implemented, so there is no simulation for this spec.
export default defineSpec<Spec.SpecHolyPriest>({
	spec: Spec.SpecHolyPriest,
	// Nothing is simulated, so the incoming-healing model stays off.
	enableHealing: false,

	className: 'holy-priest-sim-ui',
	cssScheme: PlayerClasses.getCssScheme(PlayerClasses.Priest),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP.
	epReferenceStat: Stat.StatSpellPower,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[Stat.StatHealth, Stat.StatMana, Stat.StatStamina, Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatMasteryRating],
		[PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.P5_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.DEFAULT_EP_PRESET.epWeights,
		// Default soft caps for the Reforge optimizer: reach a Renew tick breakpoint, then value
		// haste at QE Live's weight (zero).
		softCapBreakpoints: [
			StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [hasteBreakpoints.get('5-tick - Renew')!, hasteBreakpoints.get('6-tick - Renew')!],
				capType: StatCapType.TypeThreshold,
				postCapEPs: [Presets.QE_HASTE_EP_PAST_BREAKPOINT * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			}),
		],
		breakpointLimits: new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHastePercent, hasteBreakpoints.get('5-tick - Renew')!),
		other: Presets.OtherDefaults,
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.DefaultTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: defaultHealerRaidBuffs(),
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({}),
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [PriestInputs.ArmorInput()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	// Stamina is not an EP stat for healers, but the buff still belongs in the stats panel.
	includeBuffDebuffInputs: [BuffDebuffInputs.StaminaBuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [],
	},
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.DEFAULT_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DefaultTalents],
		// Preset rotations that the user can quickly select.
		rotations: [],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P5_PRESET],
	},

	autoRotation: (_: Player<Spec.SpecHolyPriest>): APLRotation => {
		return APLRotation.create();
	},

	reforge: {
		statSelectionPresets: Presets.HOLY_BREAKPOINTS,
		enableBreakpointLimits: true,
	},
});
