import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { Mage } from '../../core/player_classes/mage';
import { APLRotation } from '../../core/proto/apl';
import { Faction, IndividualBuffs, ItemSlot, PartyBuffs, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { DEFAULT_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { formatToNumber } from '../../core/utils';
import { DefaultDebuffs, DefaultRaidBuffs, MAGE_BREAKPOINTS } from '../presets';
import * as ArcaneInputs from './inputs';
import * as Presets from './presets';
import * as MageInputs from '../inputs';

const hasteBreakpoints = MAGE_BREAKPOINTS.presets;
const MAX_HASTE_PERCENT_BREAKPOINT_THRESHOLD = 53.85;

const SPEC_CONFIG = registerSpecConfig(Spec.SpecArcaneMage, {
	cssClass: 'arcane-mage-sim-ui',
	cssScheme: PlayerClasses.getCssClass(Mage),
	// List any known bugs / issues here and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating], // Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
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
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_CASTER_GEM_STATS,

	defaults: {
		// Default equipped gear.
		gear: Presets.P2_BIS.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_BIS_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: (() => {
			const hitCap = new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
			const hasteCap = new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHastePercent, 53.32);

			return hitCap.add(hasteCap);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteBreakpointConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [
					hasteBreakpoints.get('5-tick - Living Bomb')!,
					// hasteBreakpoints.get('6-tick - Living Bomb')!,
					hasteBreakpoints.get('7-tick - Living Bomb')!,
					// hasteBreakpoints.get('8-tick - Living Bomb')!,
					// hasteBreakpoints.get('9-tick - Living Bomb')!,
					// hasteBreakpoints.get('10-tick - Living Bomb')!,
					// hasteBreakpoints.get('11-tick - Living Bomb')!,
					// hasteBreakpoints.get('12-tick - Living Bomb')!,
				],
				capType: StatCapType.TypeThreshold,
				postCapEPs: [0.62 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [MAX_HASTE_PERCENT_BREAKPOINT_THRESHOLD],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0.38 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			return [hasteBreakpointConfig, hasteSoftCapConfig];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.ArcaneTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultArcaneOptions,
		other: Presets.OtherDefaults,
		// Default raid/party buffs settings.
		raidBuffs: DefaultRaidBuffs,

		partyBuffs: PartyBuffs.create({}),
		individualBuffs: IndividualBuffs.create({}),
		debuffs: DefaultDebuffs,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [MageInputs.MageArmorInputs()],
	// Inputs to include in the 'Rotation' section on the settings tab.
	rotationInputs: ArcaneInputs.MageRotationConfig,
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [OtherInputs.InputDelay, OtherInputs.DistanceFromTarget, OtherInputs.TankAssignment],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: true,
	},

	presets: {
		epWeights: [Presets.P1_PREBIS_EP_PRESET, Presets.P1_BIS_EP_PRESET, Presets.P3_BIS_EP_PRESET],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_DEFAULT, Presets.ROTATION_PRESET_T15_4PC],
		// Preset talents that the user can quickly select.
		talents: [Presets.ArcaneTalents, Presets.ArcaneTalentsCleave],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PREBIS, Presets.P2_BIS, Presets.P3_BIS],

		builds: [Presets.P1_PRESET_BUILD_DEFAULT, Presets.P1_PRESET_BUILD_CLEAVE, Presets.T14_PRESET_BUILD, Presets.T15_PRESET_BUILD],
	},

	autoRotation: (player: Player<Spec.SpecArcaneMage>): APLRotation => {
		// const numTargets = player.sim.encounter.targets.length;
		// if (numTargets >= 2) {
		// 	return Presets.ROTATION_PRESET_CLEAVE.rotation.rotation!;
		// } else {
		return Presets.ROTATION_PRESET_DEFAULT.rotation.rotation!;
		// }
	},

	raidSimPresets: [
		{
			spec: Spec.SpecArcaneMage,
			talents: Presets.ArcaneTalents.data,
			specOptions: Presets.DefaultArcaneOptions,
			consumables: Presets.DefaultConsumables,
			otherDefaults: Presets.OtherDefaults,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceAlliancePandaren,
				[Faction.Horde]: Race.RaceTroll,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.PREBIS.gear,
				},
				[Faction.Horde]: {
					1: Presets.PREBIS.gear,
				},
			},
		},
	],
});

export class ArcaneMageSimUI extends IndividualSimUI<Spec.SpecArcaneMage> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecArcaneMage>) {
		super(parentElem, player, SPEC_CONFIG);

		const statSelectionPresets = [
			{
				unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
				presets: hasteBreakpoints,
			},
		];

		this.reforger = new ReforgeOptimizer(this, {
			statSelectionPresets: statSelectionPresets,
			enableBreakpointLimits: true,
			getEPDefaults: player => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 525) {
					return Presets.P3_BIS_EP_PRESET.epWeights;
				} else if (avgIlvl >= 495) {
					return Presets.P1_BIS_EP_PRESET.epWeights;
				}
				return Presets.P1_PREBIS_EP_PRESET.epWeights;
			},
			updateSoftCaps: softCaps => {
				const raidBuffs = player.getRaid()?.getBuffs();
				const hasBL = !!raidBuffs?.bloodlust;
				const hasBerserking = player.getRace() === Race.RaceTroll;

				const modifyHaste = (oldHastePercent: number, modifier: number) =>
					Number(formatToNumber(((oldHastePercent / 100 + 1) / modifier - 1) * 100, { maximumFractionDigits: 5 }));

				const softCapToModify = softCaps.find(
					sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent) && sc.capType === StatCapType.TypeThreshold,
				);
				if (softCapToModify) {
					const adjustedHasteBreakpoints = new Set([...softCapToModify.breakpoints]);
					const hasCloseMatchingValue = (value: number) => [...adjustedHasteBreakpoints.values()].find(bp => bp.toFixed(2) === value.toFixed(2));

					softCapToModify.breakpoints.forEach(breakpoint => {
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
						.filter(bp => bp <= MAX_HASTE_PERCENT_BREAKPOINT_THRESHOLD)
						.sort((a, b) => a - b);
				}
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
									<p className="mb-0">Additional Living Bomb breakpoints have been created using the following cooldowns:</p>
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
