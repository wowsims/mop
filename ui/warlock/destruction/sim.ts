import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import { HASTE_RATING_PER_HASTE_PERCENT } from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Faction, ItemSlot, PartyBuffs, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { DEFAULT_CASTER_GEM_STATS, Stats, UnitStat } from '../../core/proto_utils/stats';
import { TypedEvent } from '../../core/typed_event';
import * as WarlockInputs from '../inputs';
import * as Presets from './presets';

const modifyDisplayStats = (player: Player<Spec.SpecDestructionWarlock>) => {
	let stats = new Stats();

	TypedEvent.freezeAllAndDo(() => {
		const currentStats = player.getCurrentStats().finalStats?.stats;
		if (currentStats === undefined) {
			return {};
		}

		stats = stats.addStat(Stat.StatMP5, (currentStats[Stat.StatMP5] * currentStats[Stat.StatHasteRating]) / HASTE_RATING_PER_HASTE_PERCENT / 100);
	});

	return {
		talents: stats,
	};
};

const SPEC_CONFIG = registerSpecConfig(Spec.SpecDestructionWarlock, {
	cssClass: 'destruction-warlock-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Warlock),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP. DPS classes use either spell power or attack power.
	epReferenceStat: Stat.StatSpellPower,
	// Which stats to display in the Character Stats section, at the bottom of the left-hand sidebar.
	displayStats: UnitStat.createDisplayStatArray(
		[
			Stat.StatHealth,
			Stat.StatMana,
			Stat.StatStamina,
			Stat.StatIntellect,
			Stat.StatSpellPower,
			Stat.StatMasteryRating,
			Stat.StatExpertiseRating,
			Stat.StatMP5,
		],
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_CASTER_GEM_STATS,

	modifyDisplayStats,
	defaults: {
		// Default equipped gear.
		gear: Presets.P1_PRESET.gear,

		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.DEFAULT_EP_PRESET.epWeights,
		// Default stat caps for the Reforge optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,

		// Default talents.
		talents: Presets.DestructionTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,

		// Default buffs and debuffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,

		partyBuffs: PartyBuffs.create({}),

		individualBuffs: Presets.DefaultIndividualBuffs,

		debuffs: Presets.DefaultDebuffs,

		other: Presets.OtherDefaults,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [WarlockInputs.PetInput()],

	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [BuffDebuffInputs.AttackSpeedBuff, BuffDebuffInputs.PhysicalDamageDebuff, BuffDebuffInputs.MajorArmorDebuff],
	excludeBuffDebuffInputs: [],
	petConsumeInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.DistanceFromTarget, OtherInputs.TankAssignment, OtherInputs.ChannelClipDelay],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.DEFAULT_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DestructionTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.DEFAULT_APL],

		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_PREBIS_PRESET, Presets.P1_PRESET],
		itemSwaps: [],
	},

	autoRotation: (_player: Player<Spec.SpecDestructionWarlock>): APLRotation => {
		return Presets.DEFAULT_APL.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecDestructionWarlock,
			talents: Presets.DestructionTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceHuman,
				[Faction.Horde]: Race.RaceOrc,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P1_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.P1_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
});

export class DestructionWarlockSimUI extends IndividualSimUI<Spec.SpecDestructionWarlock> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecDestructionWarlock>) {
		super(parentElem, player, SPEC_CONFIG);
		player.sim.waitForInit().then(() => {
			new ReforgeOptimizer(this, {
				statSelectionPresets: Presets.DESTRUCTION_BREAKPOINTS,
			});
		});
	}
}
