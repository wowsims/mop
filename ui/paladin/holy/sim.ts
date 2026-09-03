import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Debuffs, IndividualBuffs, PartyBuffs, PseudoStat, RaidBuffs, Spec, Stat } from '../../core/proto/common';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, UnitStat } from '../../core/proto_utils/stats';
import { defaultRaidBuffMajorDamageCooldowns } from '../../core/proto_utils/utils';
import * as PaladinInputs from '../inputs';
import * as Presets from './presets';

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
		gear: Presets.PRERAID_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.DEFAULT_EP_PRESET.epWeights,
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
	includeBuffDebuffInputs: [],
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
		gear: [Presets.PRERAID_PRESET],
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
		});
	}
}
