import { AttackSpeedBuff } from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs.js';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui.js';
import { Player } from '../../core/player.js';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl.js';
import { Faction, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, Spec, Stat } from '../../core/proto/common.js';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, Stats, UnitStat } from '../../core/proto_utils/stats.js';
import { TypedEvent } from '../../core/typed_event';
import * as ShamanInputs from '../inputs.js';
import * as ElementalInputs from './inputs.js';
import * as Presets from './presets.js';
import i18n from '../../i18n/config';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecElementalShaman, {
	cssClass: 'elemental-shaman-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Shaman),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],
	warnings: [
		simUI => {
			return {
				updateOn: TypedEvent.onAny([simUI.player.specOptionsChangeEmitter, simUI.player.talentsChangeEmitter]),
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

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP.
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
			Stat.StatExpertiseRating,
			Stat.StatMasteryRating,
		],
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,
	defaults: {
		// Default equipped gear.
		gear: Presets.P3_GEAR_PRESET.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.EP_PRESET_P3.epWeights,
		// Default stat caps for the Reforge optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.P3_TALENTS.data,
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
	playerIconInputs: [ShamanInputs.ShamanShieldInput()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [AttackSpeedBuff],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [ElementalInputs.InThunderstormRange, OtherInputs.InputDelay, OtherInputs.TankAssignment, OtherInputs.DistanceFromTarget],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	customSections: [ShamanInputs.TotemsSection],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.EP_PRESET_P3,Presets.EP_PRESET_P2, Presets.EP_PRESET_AOE],
		// Preset talents that the user can quickly select.
		talents: [Presets.P3_TALENTS, Presets.TalentsAoE],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_P3, Presets.ROTATION_PRESET_AOE, Presets.ROTATION_PRESET_CLEAVE],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_GEAR_PRESET, Presets.P2_GEAR_PRESET, Presets.P3_GEAR_PRESET],

		builds: [Presets.P3_PRESET_BUILD_DEFAULT, Presets.P3_PRESET_BUILD_PRERAID, Presets.PRESET_BUILD_CLEAVE, Presets.PRESET_BUILD_AOE],
	},

	autoRotation: (_player: Player<Spec.SpecElementalShaman>): APLRotation => {
		const numTargets = _player.sim.encounter.targets.length;

		if (numTargets > 2) return Presets.ROTATION_PRESET_AOE.rotation.rotation!;
		if (numTargets == 2) return Presets.ROTATION_PRESET_CLEAVE.rotation.rotation!;

		return Presets.ROTATION_PRESET_P3.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecElementalShaman,
			talents: Presets.P3_TALENTS.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceDraenei,
				[Faction.Horde]: Race.RaceTroll,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.P3_GEAR_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.P3_GEAR_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
});

export class ElementalShamanSimUI extends IndividualSimUI<Spec.SpecElementalShaman> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecElementalShaman>) {
		super(parentElem, player, SPEC_CONFIG);
		this.reforger = new ReforgeOptimizer(this, {
			getEPDefaults: player => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 518) {
					return Presets.EP_PRESET_P3.epWeights;
				}
				return Presets.EP_PRESET_P2.epWeights;
			},
		});
	}
}
