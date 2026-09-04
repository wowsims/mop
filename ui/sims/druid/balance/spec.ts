import * as Mechanics from '@domain/constants/mechanics';
import { formatToNumber } from '@domain/format';
import { Player } from '@domain/player';
import { PlayerClasses } from '@domain/player_classes';
import * as StatCaps from '@domain/presets/stat_caps';
import { DEFAULT_HYBRID_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '@domain/proto_utils/stats';
import * as OtherInputs from '@features/settings/model/other_inputs';
import { defineSpec } from '@features/spec_config';
import { StatCapType } from '@generated/proto/api';
import { APLRotation, APLRotation_Type } from '@generated/proto/apl';
import { ItemSlot, PseudoStat, Spec, Stat } from '@generated/proto/common';

import * as DruidInputs from '../shared/inputs';
import * as BalanceInputs from './inputs';
import * as Presets from './presets';

type EpAtPercent = (percent: number) => number;

const masteryEpAtPercent = (exponent: number, targetPercent: number, startEp: number, endEp: number) => {
	const t = Math.max(0, Math.min(1, (targetPercent - 30) / 170));
	return endEp + (startEp - endEp) * (1 - Math.pow(t, exponent));
};

const masterySoftCapEpAtPercent = (masteryPercent: number) => masteryEpAtPercent(0.700341117, masteryPercent, 0.82, 0.43);

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

const findEpIntersection = (first: EpAtPercent, second: EpAtPercent, minPercent: number, maxPercent: number, step = 0.25): number | null => {
	let previousPercent = minPercent;
	let previousDifference = first(previousPercent) - second(previousPercent);

	for (let currentPercent = minPercent + step; currentPercent <= maxPercent; currentPercent += step) {
		const currentDifference = first(currentPercent) - second(currentPercent);

		if (previousDifference === 0) {
			return previousPercent;
		}

		if (previousDifference * currentDifference <= 0) {
			let lower = previousPercent;
			let upper = currentPercent;
			let lowerDifference = previousDifference;

			for (let i = 0; i < 50; i++) {
				const mid = (lower + upper) / 2;
				const midDifference = first(mid) - second(mid);

				if (lowerDifference * midDifference <= 0) {
					upper = mid;
				} else {
					lower = mid;
					lowerDifference = midDifference;
				}
			}

			return Math.round(((lower + upper) / 2) * 1000) / 1000;
		}

		previousPercent = currentPercent;
		previousDifference = currentDifference;
	}

	return null;
};

const getMasteryCritEpIntersection = (critEpFormula: EpAtPercent) => findEpIntersection(masterySoftCapEpAtPercent, critEpFormula, 30, 100);

// Pure precompute hoisted out of the old ctor: builds haste breakpoint variants
// (base / BL / Zerk / BL+Zerk) for the stat selection preset dropdown.
const statSelectionHastePreset = (() => {
	const preset = {
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
			preset.presets.set(variantName, variantValue);
		}
	}

	for (const [name, breakpoint] of Presets.BALANCE_BREAKPOINTS!.presets) {
		const variants = createHasteBreakpointVariants(name, breakpoint);
		for (const [variantName, variantValue] of variants) {
			preset.presets.set(variantName, variantValue);
		}
	}

	return preset;
})();

export default defineSpec<Spec.SpecBalanceDruid>({
	spec: Spec.SpecBalanceDruid,

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
		gear: Presets.T16PresetGear.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P5_BIS_EP_PRESET.epWeights,
		// Default stat caps for the Reforge optimizer
		statCaps: StatCaps.spellHitCap(),
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
				breakpoints: [43],
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
		epWeights: [Presets.P2_BIS_EP_PRESET, Presets.P3_BIS_EP_PRESET, Presets.P5_BIS_EP_PRESET],
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

	reforge: {
		statSelectionPresets: [statSelectionHastePreset],
		enableBreakpointLimits: true,
		getEPDefaults: player => {
			const avgIlvl = player.getGear().getAverageItemLevel(false);
			if (avgIlvl >= 560) return Presets.P5_BIS_EP_PRESET.epWeights;
			if (avgIlvl >= 525) return Presets.P3_BIS_EP_PRESET.epWeights;
			return Presets.P2_BIS_EP_PRESET.epWeights;
		},
		updateSoftCaps: (softCaps, player) => {
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
				const critFormula = hasUVLS ? critUVLSEpAtPercent : critEpAtPercent;
				const critMasteryIntersection = getMasteryCritEpIntersection(critFormula);
				if (softCapToModify) {
					if (!!critMasteryIntersection) {
						softCapToModify.breakpoints = [critMasteryIntersection];
						softCapToModify.postCapEPs = [critFormula(critMasteryIntersection) * Mechanics.CRIT_RATING_PER_CRIT_PERCENT];
					} else if (hasUVLS) {
						softCapToModify.breakpoints = [43];
						softCapToModify.postCapEPs = [critFormula(softCapToModify.breakpoints[0]) * Mechanics.CRIT_RATING_PER_CRIT_PERCENT];
					}
				}

				if (!!critMasteryIntersection) {
					const masteryStat = UnitStat.fromStat(Stat.StatMasteryRating);
					const masteryBreakpoint = masteryStat.convertPercentToRating(critMasteryIntersection)! / player.getMasteryPerPointModifier();
					const masteryPostCapEp = masterySoftCapEpAtPercent(critMasteryIntersection);

					const masterySoftCapConfig = StatCap.fromStat(Stat.StatMasteryRating, {
						breakpoints: [masteryBreakpoint],
						capType: StatCapType.TypeSoftCap,
						postCapEPs: [masteryPostCapEp],
					});

					softCaps.push(masterySoftCapConfig);
				}
			}

			return softCaps;
		},
	},
});
