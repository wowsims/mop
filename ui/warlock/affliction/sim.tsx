import * as BuffDebuffInputs from '../../core/components/inputs/buffs_debuffs';
import * as OtherInputs from '../../core/components/inputs/other_inputs';
import { ReforgeOptimizer } from '../../core/components/suggest_reforges_action';
import * as Mechanics from '../../core/constants/mechanics.js';
import { IndividualSimUI, registerSpecConfig } from '../../core/individual_sim_ui';
import { Player } from '../../core/player';
import { PlayerClasses } from '../../core/player_classes';
import { APLRotation } from '../../core/proto/apl';
import { Faction, ItemSlot, PartyBuffs, PseudoStat, Race, Spec, Stat } from '../../core/proto/common';
import { StatCapType } from '../../core/proto/ui';
import { DEFAULT_CASTER_GEM_STATS, StatCap, Stats, UnitStat } from '../../core/proto_utils/stats';
import { formatToNumber } from '../../core/utils';
import * as WarlockInputs from '../inputs';
import * as Presets from './presets';

const relevantDotBreakpoints = [
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('8-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('14-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('11-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('15-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('9-tick - Unstable Affliction')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('12-tick - Corruption')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('16-tick - Agony')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('10-tick - Unstable Affliction')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('17-tick - Agony')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('13-tick - Corruption')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('18-tick - Agony')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('14-tick - Corruption')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('11-tick - Unstable Affliction')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('19-tick - Agony')!,
	Presets.AFFLICTION_BREAKPOINTS.presets.get('15-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('20-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('12-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('21-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('16-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('13-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('22-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('17-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('23-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('14-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('18-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('24-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('25-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('19-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('15-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('26-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('20-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('27-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('16-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('21-tick - Corruption')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('28-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('17-tick - Unstable Affliction')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('29-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('30-tick - Agony')!,
	// Presets.AFFLICTION_BREAKPOINTS.presets.get('31-tick - Agony')!,
];

const SPEC_CONFIG = registerSpecConfig(Spec.SpecAfflictionWarlock, {
	cssClass: 'affliction-warlock-sim-ui',
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
		epWeights: Presets.P2_BIS_EP_PRESET.epWeights,
		// Default stat caps for the Reforge optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default soft caps for the Reforge optimizer
		softCapBreakpoints: (() => {
			const hasteSoftCapConfig = StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
				breakpoints: relevantDotBreakpoints,
				capType: StatCapType.TypeSoftCap,
				postCapEPs: relevantDotBreakpoints.map(
					() => (Presets.P1_BIS_EP_PRESET.epWeights.getStat(Stat.StatMasteryRating) - 0.05) * Mechanics.HASTE_RATING_PER_HASTE_PERCENT,
				),
			});

			return [hasteSoftCapConfig];
		})(),
		// Default consumes settings.
		consumables: Presets.DefaultConsumables,

		// Default talents.
		talents: Presets.AfflictionTalents.data,
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
		inputs: [
			WarlockInputs.DetonateSeed(),
			OtherInputs.InputDelay,
			OtherInputs.DistanceFromTarget,
			OtherInputs.TankAssignment,
			OtherInputs.ChannelClipDelay,
		],
	},
	itemSwapSlots: [ItemSlot.ItemSlotMainHand, ItemSlot.ItemSlotOffHand, ItemSlot.ItemSlotTrinket1, ItemSlot.ItemSlotTrinket2],
	encounterPicker: {
		// Whether to include 'Execute Duration (%)' in the 'Encounter' section of the settings tab.
		showExecuteProportion: false,
	},

	presets: {
		epWeights: [Presets.P1_BIS_EP_PRESET, Presets.P2_BIS_EP_PRESET],
		// Preset talents that the user can quickly select.
		talents: [Presets.AfflictionTalents],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.APL_Default],

		// Preset gear configurations that the user can quickly select.
		gear: [Presets.PRERAID_PRESET, Presets.P1_PRESET, Presets.P2_PRESET],
		itemSwaps: [],
	},

	autoRotation: (_player: Player<Spec.SpecAfflictionWarlock>): APLRotation => {
		return Presets.APL_Default.rotation.rotation!;
	},

	raidSimPresets: [
		{
			spec: Spec.SpecAfflictionWarlock,
			talents: Presets.AfflictionTalents.data,
			specOptions: Presets.DefaultOptions,
			consumables: Presets.DefaultConsumables,
			defaultFactionRaces: {
				[Faction.Unknown]: Race.RaceUnknown,
				[Faction.Alliance]: Race.RaceHuman,
				[Faction.Horde]: Race.RaceTroll,
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

export class AfflictionWarlockSimUI extends IndividualSimUI<Spec.SpecAfflictionWarlock> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecAfflictionWarlock>) {
		super(parentElem, player, SPEC_CONFIG);

		const statSelectionPresets = [
			{
				unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
				presets: Presets.AFFLICTION_BREAKPOINTS.presets,
			},
		];

		this.reforger = new ReforgeOptimizer(this, {
			statSelectionPresets,
			enableBreakpointLimits: true,
			getEPDefaults: player => {
				const avgIlvl = player.getGear().getAverageItemLevel(false);
				if (avgIlvl >= 512) {
					return Presets.P2_BIS_EP_PRESET.epWeights;
				}
				return Presets.P1_BIS_EP_PRESET.epWeights;
			},
			// updateSoftCaps: softCaps => {
			// 	const raidBuffs = player.getRaid()?.getBuffs();
			// 	const hasBL = !!raidBuffs?.bloodlust;
			// 	const hasBerserking = player.getRace() === Race.RaceTroll;

			// 	const modifyHaste = (oldHastePercent: number, modifier: number) =>
			// 		Number(formatToNumber(((oldHastePercent / 100 + 1) / modifier - 1) * 100, { maximumFractionDigits: 5 }));

			// 	this.individualConfig.defaults.softCapBreakpoints!.forEach(softCap => {
			// 		const softCapToModify = softCaps.find(sc => sc.unitStat.equals(softCap.unitStat));
			// 		if (softCap.unitStat.equalsPseudoStat(PseudoStat.PseudoStatSpellHastePercent) && softCapToModify) {
			// 			const adjustedHasteBreakpoints = new Set([...softCap.breakpoints]);
			// 			const hasCloseMatchingValue = (value: number) =>
			// 				[...adjustedHasteBreakpoints.values()].find(bp => bp.toFixed(2) === value.toFixed(2));

			// 			softCap.breakpoints.forEach(breakpoint => {
			// 				const dsMiseryBreakpoint = modifyHaste(breakpoint, 1.3);
			// 				if (dsMiseryBreakpoint > 0 && !hasCloseMatchingValue(dsMiseryBreakpoint)) {
			// 					adjustedHasteBreakpoints.add(dsMiseryBreakpoint);
			// 				}
			// 				if (hasBL) {
			// 					const blBreakpoint = modifyHaste(breakpoint, 1.3);

			// 					if (blBreakpoint > 0) {
			// 						if (!hasCloseMatchingValue(blBreakpoint)) adjustedHasteBreakpoints.add(blBreakpoint);

			// 						const dsMiseryBlBreakpoint = modifyHaste(blBreakpoint, 1.3);
			// 						if (dsMiseryBlBreakpoint > 0 && !hasCloseMatchingValue(dsMiseryBlBreakpoint)) {
			// 							adjustedHasteBreakpoints.add(dsMiseryBlBreakpoint);
			// 						}

			// 						if (hasBerserking) {
			// 							const berserkingBreakpoint = modifyHaste(blBreakpoint, 1.2);
			// 							if (berserkingBreakpoint > 0 && !hasCloseMatchingValue(berserkingBreakpoint)) {
			// 								adjustedHasteBreakpoints.add(berserkingBreakpoint);
			// 							}
			// 						}
			// 					}
			// 				}
			// 			});
			// 			softCapToModify.breakpoints = [...adjustedHasteBreakpoints].sort((a, b) => a - b);
			// 		}
			// 	});
			// 	return softCaps;
			// },
			// additionalSoftCapTooltipInformation: {
			// 	[Stat.StatHasteRating]: () => {
			// 		const raidBuffs = player.getRaid()?.getBuffs();
			// 		const hasBL = !!raidBuffs?.bloodlust;
			// 		const hasBerserking = player.getRace() === Race.RaceTroll;

			// 		return (
			// 			<>
			// 				{(hasBL || hasBerserking) && (
			// 					<>
			// 						<p className="mb-0">Additional breakpoints have been created using the following cooldowns:</p>
			// 						<ul className="mb-0">
			// 							{<li>Dark Soul: Misery</li>}
			// 							{hasBL && <li>Bloodlust</li>}
			// 							{hasBerserking && <li>Berserking</li>}
			// 						</ul>
			// 					</>
			// 				)}
			// 			</>
			// 		);
			// 	},
			// },
		});
	}
}
