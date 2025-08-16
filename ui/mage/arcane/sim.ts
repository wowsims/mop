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
import { TypedEvent } from '../../core/typed_event';
import { formatToNumber } from '../../core/utils';
import { DefaultDebuffs, DefaultRaidBuffs, MAGE_BREAKPOINTS } from '../presets';
import * as ArcaneInputs from './inputs';
import * as Presets from './presets';
import * as MageInputs from '../inputs';

const hasteBreakpoints = MAGE_BREAKPOINTS.presets;

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
		gear: Presets.P1_POST_MSV.gear,
		// Default EP weights for sorting gear in the gear picker.
		epWeights: Presets.P1_EP_PRESET.epWeights,
		// Default stat caps for the Reforge Optimizer
		statCaps: (() => {
			return new Stats().withPseudoStat(PseudoStat.PseudoStatSpellHitPercent, 15);
		})(),
		// Default soft caps for the Reforge optimizer - Only practical haste breakpoints
		softCapBreakpoints: (() => {
			// Curated practical breakpoints with calculated EP weights
			const practicalBreakpoints = [
				12.507036,  // 5-tick Living Bomb
				24.9766,    // 7-tick LB w/ Lust
				37.520061,  // 6-tick Living Bomb
			];

			return [
				StatCap.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent, {
					breakpoints: practicalBreakpoints,
					capType: StatCapType.TypeThreshold,
					postCapEPs: [], // We use getEPDefaults callback instead
				}),
			];
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
	playerIconInputs: [
		MageInputs.MageArmorInputs()
	],
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
		epWeights: [
			Presets.P1_EP_PRESET, // Default EP weights - automatic switching handles breakpoint-specific weights
		],
		// Preset rotations that the user can quickly select.
		rotations: [Presets.ROTATION_PRESET_DEFAULT],
		// Preset talents that the user can quickly select.
		talents: [Presets.ArcaneTalents, Presets.ArcaneTalentsCleave],
		// Preset gear configurations that the user can quickly select.
		gear: [Presets.P1_POST_MSV, Presets.P1_POST_HOF, Presets.P1_BIS],

		builds: [Presets.P1_PRESET_BUILD_DEFAULT, Presets.P1_PRESET_BUILD_CLEAVE],
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
					1: Presets.P1_POST_MSV.gear,
				},
				[Faction.Horde]: {
					1: Presets.P1_POST_MSV.gear,
				},
			},
		},
	],
});

export class ArcaneMageSimUI extends IndividualSimUI<Spec.SpecArcaneMage> {
	constructor(parentElem: HTMLElement, player: Player<Spec.SpecArcaneMage>) {
		super(parentElem, player, SPEC_CONFIG);

		// Curated practical haste breakpoints for the reforge optimizer
		const practicalHasteBreakpoints = new Map([
			['LB: 5-Tick', 12.507036],
			['LB: 7-Tick w/Lust', 24.9766],
			['LB: 6-Tick', 37.520061],
		]);

		player.sim.waitForInit().then(() => {
			// Helper function to calculate EP weights for a specific haste breakpoint
			const calculateEPForBreakpoint = async (hastePercent: number, breakpointName: string) => {
				console.log(`Calculating EP weights for ${breakpointName} (${hastePercent}% haste)`);

				try {
					// Calculate EP weights using the current player configuration
					const result = await this.player.computeStatWeights(
						TypedEvent.nextEventID(),
						[Stat.StatIntellect, Stat.StatSpellPower, Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating], // stats to calculate
						[], // pseudostats to calculate
						Stat.StatSpellPower, // reference stat
						(progress) => {
							console.log(`EP calculation progress for ${breakpointName}:`, progress);
						}
					);

					if (result && result.dps && result.dps.weights) {
						const weights = result.dps.weights;
						const intellectEP = UnitStat.fromStat(Stat.StatIntellect).getProtoValue(weights);
						const hitEP = UnitStat.fromStat(Stat.StatHitRating).getProtoValue(weights);
						const critEP = UnitStat.fromStat(Stat.StatCritRating).getProtoValue(weights);
						const hasteEP = UnitStat.fromStat(Stat.StatHasteRating).getProtoValue(weights);
						const masteryEP = UnitStat.fromStat(Stat.StatMasteryRating).getProtoValue(weights);

						console.log(`${breakpointName} EP Values:`, {
							intellect: intellectEP,
							hit: hitEP,
							crit: critEP,
							haste: hasteEP,
							mastery: masteryEP
						});

						// Create the EP weights object normalized to spell power = 1.0
						const epWeights = new Stats()
							.withStat(Stat.StatIntellect, intellectEP)
							.withStat(Stat.StatSpellPower, 1.0) // Reference stat
							.withStat(Stat.StatHitRating, hitEP)
							.withStat(Stat.StatCritRating, critEP)
							.withStat(Stat.StatHasteRating, hasteEP)
							.withStat(Stat.StatMasteryRating, masteryEP);

						return epWeights;
					}
				} catch (error) {
					console.error(`Error calculating EP weights for ${breakpointName}:`, error);
				}
				return null;
			};

			// Add a global function for manual EP calculation testing
			// Usage in console: window.calculateBreakpointEPs()
			(window as any).calculateBreakpointEPs = async () => {
				console.log('=== Starting EP Calculation for All Breakpoints ===');

				const breakpoints = [
					{ value: 12.507036, name: '5-tick Living Bomb' },
					{ value: 24.9766, name: '7-tick LB w/ Lust' },
					{ value: 37.520061, name: '6-tick Living Bomb' },
					// Higher breakpoints removed - unrealistic haste levels
					// { value: 62.469546, name: '7-tick Living Bomb' },
					// { value: 87.441436, name: '8-tick Living Bomb' },
					// { value: 112.539866, name: '9-tick Living Bomb' },
				];

				for (const breakpoint of breakpoints) {
					console.log(`\n--- Calculating ${breakpoint.name} ---`);
					const epWeights = await calculateEPForBreakpoint(breakpoint.value, breakpoint.name);
					if (epWeights) {
						console.log(`✅ ${breakpoint.name} completed`);
					} else {
						console.log(`❌ ${breakpoint.name} failed`);
					}
					// Small delay between calculations
					await new Promise(resolve => setTimeout(resolve, 1000));
				}

				console.log('\n=== EP Calculation Complete ===');
			};

			console.log('EP calculation function available: window.calculateBreakpointEPs()');

			// Create mapping of breakpoint values to EP presets
			const breakpointToEPMap = new Map([
				[12.507036, Presets.P1_EP_5_TICK.epWeights], // 5-tick Living Bomb
				[24.9766, Presets.P1_EP_7_TICK_LUST.epWeights], // 7-tick LB w/ Lust
				[37.520061, Presets.P1_EP_6_TICK.epWeights], // 6-tick Living Bomb
				// Higher breakpoints commented out - unrealistic haste levels
				// [62.469546, Presets.P1_EP_7_TICK.epWeights], // 7-tick Living Bomb
				// [87.441436, Presets.P1_EP_8_TICK.epWeights], // 8-tick Living Bomb
				// [112.539866, Presets.P1_EP_9_TICK.epWeights], // 9-tick Living Bomb
			]);

			console.log('Breakpoint to EP mapping:', breakpointToEPMap);

			new ReforgeOptimizer(this, {
				statSelectionPresets: [{
					unitStat: UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent),
					presets: practicalHasteBreakpoints,
				}],
				enableBreakpointLimits: true,
				getEPDefaults: (player) => {
					// Check if soft cap breakpoints are enabled
					if (!this.sim.getUseSoftCapBreakpoints()) {
						console.log('GetEPDefaults: Soft cap breakpoints disabled - using default EP weights');
						return Presets.P1_EP_PRESET.epWeights;
					}

					const breakpointLimits = player.getBreakpointLimits();
					const selectedHasteBreakpoint = breakpointLimits.getUnitStat(UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent));

					console.log('GetEPDefaults called - Selected haste breakpoint:', selectedHasteBreakpoint);

					if (selectedHasteBreakpoint > 0) {
						// Find the EP preset that matches the selected breakpoint
						const targetEpWeights = breakpointToEPMap.get(selectedHasteBreakpoint);
						console.log('Found EP weights for breakpoint:', targetEpWeights ? 'YES' : 'NO');

						if (targetEpWeights) {
							console.log('Returning EP weights for breakpoint:', selectedHasteBreakpoint);
							return targetEpWeights;
						}
					}

					// Fallback to default EP weights (for "No Limit Set" or unrecognized breakpoints)
					console.log('Using default EP weights (no breakpoint or unrecognized value)');
					return Presets.P1_EP_PRESET.epWeights;
				}
			});

			// Also add a change listener to automatically update EP weights when breakpoint limits change
			this.player.breakpointLimitsChangeEmitter.on(() => {
				// Check if soft cap breakpoints are enabled
				if (!this.sim.getUseSoftCapBreakpoints()) {
					console.log('Soft cap breakpoints disabled - resetting to default EP weights');
					this.player.setEpWeights(TypedEvent.nextEventID(), Presets.P1_EP_PRESET.epWeights);
					return;
				}

				const breakpointLimits = this.player.getBreakpointLimits();
				const selectedHasteBreakpoint = breakpointLimits.getUnitStat(UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent));

				console.log('Breakpoint limits changed - Selected haste breakpoint:', selectedHasteBreakpoint);

				if (selectedHasteBreakpoint > 0) {
					const targetEpWeights = breakpointToEPMap.get(selectedHasteBreakpoint);
					if (targetEpWeights) {
						console.log('Auto-switching EP weights for breakpoint:', selectedHasteBreakpoint);
						this.player.setEpWeights(TypedEvent.nextEventID(), targetEpWeights);
					}
				} else {
					// selectedHasteBreakpoint is 0 or negative - means "No Limit Set"
					console.log('No breakpoint limit set - resetting to default EP weights');
					this.player.setEpWeights(TypedEvent.nextEventID(), Presets.P1_EP_PRESET.epWeights);
				}
			});

			// Listen for changes to "Use soft cap breakpoints" checkbox
			this.sim.useSoftCapBreakpointsChangeEmitter.on(() => {
				if (!this.sim.getUseSoftCapBreakpoints()) {
					console.log('Soft cap breakpoints unchecked - resetting to default EP weights');
					this.player.setEpWeights(TypedEvent.nextEventID(), Presets.P1_EP_PRESET.epWeights);
				} else {
					console.log('Soft cap breakpoints enabled - checking for active breakpoint');
					// If enabling soft caps, check if there's already a breakpoint selected
					const breakpointLimits = this.player.getBreakpointLimits();
					const selectedHasteBreakpoint = breakpointLimits.getUnitStat(UnitStat.fromPseudoStat(PseudoStat.PseudoStatSpellHastePercent));

					if (selectedHasteBreakpoint > 0) {
						const targetEpWeights = breakpointToEPMap.get(selectedHasteBreakpoint);
						if (targetEpWeights) {
							console.log('Auto-switching EP weights for existing breakpoint:', selectedHasteBreakpoint);
							this.player.setEpWeights(TypedEvent.nextEventID(), targetEpWeights);
						}
					}
				}
			});
		});
	}
}
