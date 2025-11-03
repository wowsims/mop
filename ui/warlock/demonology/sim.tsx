import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import * as Mechanics from '../../core/constants/mechanics';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Faction, ItemSlot, PartyBuffs, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { DEFAULT_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import * as WarlockInputs from '../inputs';
import { WARLOCK_BREAKPOINTS } from '../presets';
import * as Presets from './presets';
import { formatToNumber } from '../../core/utils';

const hasteBreakpoints = WARLOCK_BREAKPOINTS.presets;

const MIN_HASTE_PERCENT_BREAKPOINT_THRESHOLD = hasteBreakpoints.get('8-tick - Shadowflame')!;
const MAX_P2_HASTE_PERCENT_BREAKPOINT_THRESHOLD = 26.0;
const MAX_P3_HASTE_PERCENT_BREAKPOINT_THRESHOLD = hasteBreakpoints.get('9-tick - Shadowflame')!;
const defaultHasteBreakpoints = [
	hasteBreakpoints.get('8-tick - Shadowflame')!,
	hasteBreakpoints.get('6-tick - Doom')!,
	hasteBreakpoints.get('9-tick - Shadowflame')!,
	hasteBreakpoints.get('10-tick - Shadowflame')!,
	hasteBreakpoints.get('7-tick - Doom')!,
	hasteBreakpoints.get('11-tick - Shadowflame')!,
	hasteBreakpoints.get('8-tick - Doom')!,
	hasteBreakpoints.get('12-tick - Shadowflame')!,
	hasteBreakpoints.get('9-tick - Doom')!,
];

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
		gear: Presets.P2_PRESET.gear,

		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.DEFAULT_EP_PRESET.epWeights,
		// Default stat caps for the RPeforge optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: defaultHasteBreakpoints,
				capType: StatCapType.TypeThreshold,
				postCapEPs: [(Presets.DEFAULT_EP_PRESET.epWeights.getStat(Stat.StatCritRating) - 0.01) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			return [hasteSoftCapConfig];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,

		// Default talents.
		talents: Presets.DemonologyTalentsDefaultP1.data,
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
		epWeights: [Presets.DEFAULT_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.DemonologyTalentsDefaultP1],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.APL_Default],

		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P1_PRESET, Presets.P2_PRESET],
		itemSwaps: [],

		builds: [Presets.PRSET_BUILD_P1],
	},

	autoRotation: (_player: Player<Spec.SpecDemonologyWarlock>): APLRotation => {
		return Presets.APL_Default.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecDemonologyWarlock,
			talents: Presets.DemonologyTalentsDefaultP1.data,
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
					1: Presets.PRERAID_PRESET.gear,
					2: Presets.P1_PRESET.gear,
				},
				[Faction.Horde]: {
					1: Presets.PRERAID_PRESET.gear,
					2: Presets.P1_PRESET.gear,
				},
			},
			otherDefaults: Presets.OtherDefaults,
		},
	],
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
			updateSoftCaps: softCaps => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				const raidBuffs = player.getRaid()?.getBuffs();
				const hasBL = !!raidBuffs?.bloodlust;
				const hasBerserking = player.getRace() === Race.RaceTroll;

				const modifyHaste = (oldHastePercent: number, modifier: number) =>
					Number(formatToNumber(((oldHastePercent / 100 + 1) / modifier - 1) * 100, { maximumFractionDigits: 5 }));

				this.individualConfig.defaults.softCapBreakpoints!.forEach(softCap => {
					const softCapToModify = softCaps.find(sc => sc.unitStat.equals(softCap.unitStat));
					if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent) && softCapToModify) {
						const adjustedHasteBreakpoints = new Set([...softCap.breakpoints]);
						const hasCloseMatchingValue = (value: number) => [...adjustedHasteBreakpoints.values()].find(bp => bp.toFixed(2) === value.toFixed(2));

						softCap.breakpoints.forEach(breakpoint => {
							if (hasBL) {
								const blBreakpoint = modifyHaste(breakpoint, 1.3);

								if (blBreakpoint > 0) {
									if (!hasCloseMatchingValue(blBreakpoint)) adjustedHasteBreakpoints.add(blBreakpoint);
									if (hasBerserking) {
										const berserkingBreakpoint = modifyHaste(blBreakpoint, 1.2);
										if (berserkingBreakpoint > 0 && !hasCloseMatchingValue(berserkingBreakpoint)) {
											adjustedHasteBreakpoints.add(berserkingBreakpoint);
										}
									}
								}
							}
						});
						softCapToModify.breakpoints = [...adjustedHasteBreakpoints]
							.filter(
								bp =>
									bp >= MIN_HASTE_PERCENT_BREAKPOINT_THRESHOLD &&
									bp <= (avgIlvl >= 525 ? MAX_P3_HASTE_PERCENT_BREAKPOINT_THRESHOLD : MAX_P2_HASTE_PERCENT_BREAKPOINT_THRESHOLD),
							)
							.sort((a, b) => a - b);
					}
				});
				return softCaps;
			},
			additionalSoftCapTooltipInformation: {
				[Stat.StatHasteRating]: () => {
					const raidBuffs = player.getRaid()?.getBuffs();
					const hasBL = !!raidBuffs?.bloodlust;
					const hasBerserking = player.getRace() === Race.RaceTroll;

					return (
						<>
							{(hasBL || hasBerserking) && (
								<>
									<p className="mb-0">Additional Doom/Shadowflame breakpoints have been created using the following cooldowns:</p>
									<ul className="mb-0">
										{hasBL && <li>Bloodlust</li>}
										{hasBerserking && <li>Berserking</li>}
									</ul>
								</>
							)}
						</>
					);
				},
			},
		});
	}
}
