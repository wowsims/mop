import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';

import { APLRotation, APLRotation_Type } from '../../core/proto/apl';
import { Faction, ItemSlot, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { formatToNumber } from '../../core/utils';
import * as DruidInputs from '../inputs';
import * as BalanceInputs from './inputs';
import * as Presets from './presets';

const masteryEpAtPercent = (exponent: number, targetPercent: number, startEp: number, endEp: number) => {
	const t = Math.max(0, Math.min(1, (targetPercent - 30) / 170));
	return endEp + (startEp - endEp) * (1 - Math.pow(t, exponent));
};

const critEpAtPercent = (critPercent: number) => {
	if (critPercent >= 100) return 0;

	if (critPercent < 81.64)
		return Math.max(
			0.65,
			1.24442763e-6 * critPercent * critPercent * critPercent - 0.000207423649 * critPercent * critPercent + 0.00722501562 * critPercent + 0.761687277,
		);

	const d = critPercent - 81.64;
	return 0.65 - 0.00327772325 * d - 0.00115419889 * d * d + 2.24518052e-5 * d * d * d;
};

const critUVLSEpAtPercent = (critPercent: number) => {
	if (critPercent >= 100) return 0;
	if (critPercent < 88.78)
		return 6.19142002e-7 * critPercent * critPercent * critPercent - 0.000107970309 * critPercent * critPercent + 0.00324236534 * critPercent + 0.658216265;
	const d = critPercent - 88.78;
	return 0.53 + 0.03323357 * d - 0.01160929 * d * d + 0.00067252 * d * d * d;
};

const SPEC_CONFIG = registerSpecConfig(Spec.SpecBalanceDruid, {
	cssClass: 'balance-druid-sim-ui',
	cssScheme: PlayerClasses.getCssClass(PlayerClasses.Druid),
	// List any known bugs / issues here, and they'll be shown on the site.
	knownIssues: [],

	// All stats for which EP should be calculated.
	epStats: [Stat.StatIntellect, Stat.StatSpirit, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating],
	// Reference stat against which to calculate EP. I think all classes use either spell power or attack power.
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
			Stat.StatMasteryRating,
			Stat.StatExpertiseRating,
		],
		[PseudoStat.PseudoStatSpellHitPercent, PseudoStat.PseudoStatSpellCritPercent, PseudoStat.PseudoStatSpellHastePercent],
	),
	gemStats: DEFAULT_HYBRID_CASTER_GEM_STATS,

	modifyDisplayStats: (player: Player<Spec.SpecBalanceDruid>) => {
		const playerStats = player.getCurrentStats();
		const gearStats = Stats.fromProto(playerStats.gearStats);
		const talentsStats = Stats.fromProto(playerStats.talentsStats);
		const talentsDelta = talentsStats.subtract(gearStats);
		const talentsMod = new Stats().withStat(
			Stat.StatHitRating,
			talentsDelta.getPseudoStat(PseudoStat.PseudoStatSpellHitPercent) * Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT,
		);

		return {
			talents: talentsMod,
		};
	},

	defaults: {
		// Default equipped gear.
		gear: Presets.T14PresetGear.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P2_BIS_EP_PRESET.epWeights,
		// Default stat caps for the Reforge optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default breakpoint limits - set 12T MF/SF with 4P
		breakpointLimits: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHastePercent, Presets.BALANCE_T14_4P_BREAKPOINTS!.presets.get('12-tick MF/SF')!);
		})(),
		softCapBreakpoints: (() => {
			const hasteBreakpointConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [...Presets.BALANCE_BREAKPOINTS!.presets].map(([_, value]) => value),
				capType: StatCapType.TypeThreshold,
				postCapEPs: [0.51 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: [Presets.BALANCE_BREAKPOINTS.presets.get('11-tick MF/SF')!],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [0.3 * Mechanics.HASTE_RATING_PER_HASTE_PERCENT],
			});

			const critSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellCritPercent, {
				breakpoints: [48],
				capType: StatCapType.TypeSoftCap,
				postCapEPs: [(Presets.P3_BIS_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.01) * Mechanics.CRIT_RATING_PER_CRIT_PERCENT],
			});

			return [hasteBreakpointConfig, hasteSoftCapConfig, critSoftCapConfig];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,
		// Default talents.
		talents: Presets.StandardTalents.data,
		// Default spec-specific settings.
		specOptions: Presets.DefaultOptions,
		// Default raid/party buffs settings.
		raidBuffs: Presets.DefaultRaidBuffs,
		partyBuffs: Presets.DefaultPartyBuffs,
		individualBuffs: Presets.DefaultIndividualBuffs,
		debuffs: Presets.DefaultDebuffs,
		other: Presets.OtherDefaults,
		rotationType: APLRotation_Type.TypeAuto,
	},

	// IconInputs to include in the 'Player' section on the settings tab.
	playerIconInputs: [DruidInputs.SelfInnervate()],
	// Buff and Debuff inputs to include/exclude, overriding the EP-based defaults.
	includeBuffDebuffInputs: [],
	excludeBuffDebuffInputs: [],
	// Inputs to include in the 'Other' section on the settings tab.
	otherInputs: {
		inputs: [BalanceInputs.OkfUptime, OtherInputs.TankAssignment, OtherInputs.InputDelay, OtherInputs.DistanceFromTarget],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P2_BIS_EP_PRESET, Presets.P3_BIS_EP_PRESET, Presets.P4_BIS_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.StandardTalents],
		rotations: [Presets.StandardRotation],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PreraidPresetGear, Presets.T14PresetGear, Presets.T15PresetGear, Presets.T16PresetGear],
		builds: [Presets.PresetPreraidBuild, Presets.T14PresetBuild, Presets.T15PresetBuild, Presets.T16PresetBuild],
	},

	autoRotation: (_player: Player<Spec.SpecBalanceDruid>): APLRotation => {
		return Presets.StandardRotation.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecBalanceDruid,
			talents: Presets.StandardTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			otherDefaults: Presets.OtherDefaults,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceWorgen,
				[Faction.Horde]: Race.RaceTroll,
			},
			defaultGear: {
				[Faction.Unknown]: {},
				[Faction.Alliance]: {
					1: Presets.PreraidPresetGear.gear,
				},
				[Faction.Horde]: {
					1: Presets.PreraidPresetGear.gear,
				},
			},
		},
	],
});

export class BalanceDruidSimUI extends IndividualSimUI<Spec.SpecBalanceDruid> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecBalanceDruid>) {
		super(parentElem, player, SPEC_CONFIG);
		const statSelectionHastePreset = {
			unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
			presets: new Map<string, number>([]),
		};

		const modifyHaste = (oldHastePercent: number, modifier: number) =>
			Number(formatToNumber(((oldHastePercent / 100 + 1) / modifier - 1) * 100, { maximumFractionDigits: 5 }));

		const createHasteBreakpointVariants = (name: string, breakpoint: number, prefix?: string) => {
			const breakpoints = new Map<string, number>();
			breakpoints.set(`${prefix ? `${prefix} - ` : ''}${name}`, breakpoint);

			const blBreakpoint = modifyHaste(breakpoint, 1.3);
			if (blBreakpoint > 0) {
				breakpoints.set(`${prefix ? `${prefix} - ` : ''}BL - ${name}`, blBreakpoint);
			}

			const berserkingBreakpoint = modifyHaste(breakpoint, 1.2);
			if (berserkingBreakpoint > 0) {
				breakpoints.set(`${prefix ? `${prefix} - ` : ''}Zerk - ${name}`, berserkingBreakpoint);
			}

			const blZerkingBreakpoint = modifyHaste(blBreakpoint, 1.2);
			if (blZerkingBreakpoint > 0) {
				breakpoints.set(`${prefix ? `${prefix} - ` : ''}BL+Zerk - ${name}`, blZerkingBreakpoint);
			}

			return breakpoints;
		};

		for (const [name, breakpoint] of Presets.BALANCE_T14_4P_BREAKPOINTS!.presets) {
			const variants = createHasteBreakpointVariants(name, breakpoint, 'T14 4P');
			for (const [variantName, variantValue] of variants) {
				statSelectionHastePreset.presets.set(variantName, variantValue);
			}
		}

		for (const [name, breakpoint] of Presets.BALANCE_BREAKPOINTS!.presets) {
			const variants = createHasteBreakpointVariants(name, breakpoint);
			for (const [variantName, variantValue] of variants) {
				statSelectionHastePreset.presets.set(variantName, variantValue);
			}
		}

		this.reforger = new ReforgeOptimizer(this, {
			statSelectionPresets: [statSelectionHastePreset],
			enableBreakpointLimits: true,
			getEPDefaults: player => {
				let epWeights = Presets.P2_BIS_EP_PRESET.epWeights;
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 560) {
					epWeights = Presets.P4_BIS_EP_PRESET.epWeights;
				} else if (avgIlvl >= 525) {
					epWeights = Presets.P3_BIS_EP_PRESET.epWeights;
				}

				const ampModifier = player.getTotalAmplificationTrinketStatModifier();
				epWeights = epWeights
					.withStat(Stat.StatHasteRating, epWeights.getStat(Stat.StatHasteRating) / ampModifier)
					.withStat(Stat.StatMasteryRating, epWeights.getStat(Stat.StatMasteryRating) / ampModifier);
				return epWeights;
			},
			updateSoftCaps: softCaps => {
				const gear = player.getGear();
				const hasT144P = gear.getItemSetCount('Regalia of the Eternal Blossom') >= 4;
				const hasUVLS = gear.getTrinkets().some(trinket => trinket?._item.name === 'Unerring Vision of Lei Shen');
				const avgIlvl = player.getGear().getAverageItemLevel(false);

				if (avgIlvl >= 525) {
					softCaps = softCaps.slice(1);
				}

				if (hasT144P) {
					const softCapToModify = softCaps.find(
						sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent) && sc.capType === StatCapType.TypeThreshold,
					);
					if (softCapToModify) {
						softCapToModify.breakpoints = [...Presets.BALANCE_T14_4P_BREAKPOINTS!.presets].map(([_, value]) => value);
					}
				}

				if (hasUVLS) {
					const softCapToModify = softCaps.find(sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellCritPercent));
					if (softCapToModify) {
						softCapToModify.breakpoints = [33.333];
					}
				}

				if (avgIlvl >= 560) {
					const softCapToModify = softCaps.find(sc => sc.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellCritPercent));
					if (softCapToModify) {
						const formula = hasUVLS ? critUVLSEpAtPercent : critEpAtPercent;
						const generatedCritEPBreakpoints: Map<number, number> = new Map();
						for (let percentage = 30; percentage <= 70; percentage += 10) {
							const epValue = formula(percentage);
							generatedCritEPBreakpoints.set(percentage, epValue * Mechanics.CRIT_RATING_PER_CRIT_PERCENT);
						}

						softCapToModify.breakpoints = [...generatedCritEPBreakpoints.keys()];
						softCapToModify.postCapEPs = [...generatedCritEPBreakpoints.values()];
					}

					const generatedEPBreakpoints: Map<number, number> = new Map();
					const masteryStat = UnitStat.fromStat(Stat.StatMasteryRating);
					for (let percentage = 30; percentage <= 120; percentage += 20) {
						let epValue = masteryEpAtPercent(0.700341117, percentage, 0.82, 0.43);
						generatedEPBreakpoints.set(
							masteryStat.convertPercentToRating(percentage)! / player.getMasteryPerPointModifier(),
							epValue / player.getTotalAmplificationTrinketStatModifier(),
						);
					}

					const masterySoftCapConfig = StatCap.fromStat(Stat.StatMasteryRating, {
						breakpoints: [...generatedEPBreakpoints.keys()],
						capType: StatCapType.TypeSoftCap,
						postCapEPs: [...generatedEPBreakpoints.values()],
					});

					softCaps.push(masterySoftCapConfig);
				}

				return softCaps;
			},
		});
	}
}
