import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { StatCapType } from '../../core/proto/api';
import { APLRotation } from '../../core/proto/apl';
import { ItemSlot, PartyBuffs, PseudoStat, Spec, Stat } from '../../core/proto/common';
import { DEFAULT_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import * as WarlockInputs from '../inputs';
import * as Presets from './presets';

const SPEC_CONFIG = registerSpecConfig(Spec.SpecDemonologyWarlock, {
	cssClass: 'demonology-warlock-sim-ui',
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

	defaults: {
		// Default equipped gear.
		gear: Presets.P5_PRESET.gear,

		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P5_EP_PRESET.epWeights,
		// Default stat caps for the RPeforge optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [25.00365],
				capType: StatCapType.TypeThreshold,
				postCapEPs: [(Presets.P4_EP_PRESET.epWeights.getStat(Stat.StatCritRating) - 0.01) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			return [hasteSoftCapConfig];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,

		// Default talents.
		talents: Presets.DemonologyTalentsDefault.data,
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
	includeBuffDebuffInputs: [BuffDebuffInputs.AttackSpeedBuff, BuffDebuffInputs.MajorArmorDebuff, BuffDebuffInputs.PhysicalDamageDebuff],
	excludeBuffDebuffInputs: [],
	petConsumeInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.DistanceFromTarget, OtherInputs.TankAssignment, OtherInputs.ChannelClipDelay],
	},
	itemSwapSlots: [ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2, ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P4_EP_PRESET, Presets.P5_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DemonologyTalentsDefault],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.APL_Default],

		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P2_PRESET, Presets.P3_4_PRESET, Presets.P5_PRESET],
		itemSwaps: [],

		builds: [Presets.PRESET_BUILD_P2, Presets.PRESET_BUILD_P3, Presets.PRESET_BUILD_P5],
	},

	autoRotation: (_: Player<Spec.SpecDemonologyWarlock>): APLRotation => {
		return Presets.APL_Default.rotation.rotation!;
	},
});

export class DemonologyWarlockSimUI extends IndividualSimUI<Spec.SpecDemonologyWarlock> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecDemonologyWarlock>) {
		super(parentElem, player, SPEC_CONFIG);

		const statSelectionPresets = [
			{
				unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
				presets: Presets.DEMONOLOGY_BREAKPOINTS.presets,
			},
		];

		this.reforger = new ReforgeOptimizer(this, {
			statSelectionPresets,
			enableBreakpointLimits: true,
			getEPDefaults: player => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 560) return Presets.P5_EP_PRESET.epWeights;
				return Presets.P4_EP_PRESET.epWeights;
			},
			updateSoftCaps: softCaps => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				const gear = player.getGear();
				const hasLegendaryMetaGem = gear.getMetaGem()?.id === 95347;

				if (avgIlvl >= 560) {
					this.individualConfig.defaults.softCapBreakpoints!.forEach(softCap => {
						let softCapToModifyIndex = softCaps.findIndex(sc => sc.unitStat.equals(softCap.unitStat));
						if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent) && softCapToModifyIndex !== -1) {
							softCaps[softCapToModifyIndex] = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
								breakpoints: [40.48],
								capType: StatCapType.TypeThreshold,
								postCapEPs: [
									(Presets.P5_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.02) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
								],
							});
						}
					});
				} else {
					this.individualConfig.defaults.softCapBreakpoints!.forEach(() => {
						const softCapToModify = softCaps.find(sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent));
						if (softCapToModify && hasLegendaryMetaGem) {
							softCapToModify.breakpoints = [25.74541];
						}
					});
				}
				return softCaps;
			},
			additionalSoftCapTooltipInformation: {
				[Stat.StatHasteRating]: () => {
					const hasLegendaryMetaGem = player.getGear().getMetaGem()?.id === 95347;

					return (
						<>
							{hasLegendaryMetaGem && (
								<>
									<p className="mb-0">Your Doom breakpoint has been edited because of your legendary Meta Gem</p>
								</>
							)}
						</>
					);
				},
			},
		});
	}
}
