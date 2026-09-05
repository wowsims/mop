import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, IndividualBuffs, PartyBuffs, PseudoStat, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import * as PaladinInputs from '../inputs';
import * as Presets from './presets';

const hasteBreakpoints = Presets.HOLY_BREAKPOINTS.find(entry => entry.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent))!.presets!;

// Gear planner only: no healing spells are implemented, so there is no simulation for this spec.
const SPEC_CONFIG = registerSpecConfig(Spec.SpecHolyPaladin, {
	cssClass: 'holy-paladin-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Paladin),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP.
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
		[PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent, PseudoStat.PseudoStatSpellHitPercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.P5_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.DEFAULT_EP_PRESET.epWeights,
		// Default soft caps for the Reforge optimizer: reach an Eternal Flame tick breakpoint, then
		// value haste at QE Live's weight.
		softCapBreakpoints: (() => {
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [hasteBreakpoints.get('12-tick - Eternal Flame')!, hasteBreakpoints.get('13-tick - Eternal Flame')!],
				capType: StatCapType.TypeThreshold,
				postCapEPs: [Presets.QE_HASTE_EP_PAST_BREAKPOINT * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});
			return [hasteSoftCapConfig];
		})(),
		breakpointLimits: new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHastePercent, hasteBreakpoints.get('12-tick - Eternal Flame')!),
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
			arcaneBrilliance: true,
			blessingOfKings: true,
			mindQuickening: true,
			leaderOfThePack: true,
			blessingOfMight: true,
		}),
		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: Debuffs.create({}),
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [PaladinInputs.StartingSealSelection()],
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

	autoRotation: (_: Player<Spec.SpecHolyPaladin>): APLRotation => {
		return APLRotation.create();
	},
});

export class HolyPaladinSimUI extends IndividualSimUI<Spec.SpecHolyPaladin> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecHolyPaladin>) {
		super(parentElem, player, SPEC_CONFIG);

		this.reforger = new ReforgeOptimizer(this, {
			statSelectionPresets: Presets.HOLY_BREAKPOINTS,
			enableBreakpointLimits: true,
		});
	}
}
