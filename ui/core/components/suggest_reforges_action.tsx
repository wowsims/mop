import clsx from 'clsx';
import tippy, { hideAll } from 'tippy.js';
import { ref } from 'tsx-vanilla';
import { Constraint, greaterEq, lessEq, Model, Options, Solution, solve } from 'yalps';

import i18n from '../../i18n/config.js';
import * as Mechanics from '../constants/mechanics.js';
import { IndividualSimUI } from '../individual_sim_ui';
import { Player } from '../player';
import { Class, GemColor, ItemSlot, Profession, PseudoStat, Race, ReforgeStat, Spec, Stat, UnitStats } from '../proto/common';
import { UIGem as Gem, IndividualSimSettings, ReforgeSettings, StatCapType } from '../proto/ui';
import { isShaTouchedWeapon, isThroneOfThunderWeapon, ReforgeData } from '../proto_utils/equipped_item';
import { Gear } from '../proto_utils/gear';
import { gemMatchesSocket, gemMatchesStats } from '../proto_utils/gems';
import { statCapTypeNames } from '../proto_utils/names';
import { translateSlotName, translateStat } from '../../i18n/localization';
import { pseudoStatIsCapped, StatCap, statIsCapped, Stats, UnitStat, UnitStatPresets } from '../proto_utils/stats';
import { Sim } from '../sim';
import { ActionGroupItem } from '../sim_ui';
import { EventID, TypedEvent } from '../typed_event';
import { isDevMode, sleep } from '../utils';
import { CopyButton } from './copy_button';
import { BooleanPicker } from './pickers/boolean_picker';
import { EnumPicker } from './pickers/enum_picker';
import { NumberPicker, NumberPickerConfig } from './pickers/number_picker';
import { renderSavedEPWeights } from './saved_data_managers/ep_weights';
import Toast from './toast';
import { trackEvent, trackPageView } from '../../tracking/utils';

type YalpsCoefficients = Map<string, number>;
type YalpsVariables = Map<string, YalpsCoefficients>;
type YalpsConstraints = Map<string, Constraint>;

type GemData = {
	gem: Gem;
	isJC: boolean;
	coefficients: YalpsCoefficients;
};

const INCLUDED_STATS = [
	Stat.StatHitRating,
	Stat.StatCritRating,
	Stat.StatHasteRating,
	Stat.StatExpertiseRating,
	Stat.StatMasteryRating,
	Stat.StatDodgeRating,
	Stat.StatParryRating,
];

type StatTooltipContent = { [key in Stat]?: () => Element | string };

const STAT_TOOLTIPS: StatTooltipContent = {
	[Stat.StatMasteryRating]: () => (
		<>
			Total <strong>percentage</strong>
		</>
	),
	[Stat.StatHasteRating]: () => (
		<>
			Final percentage value <strong>including</strong> all buffs/gear.
		</>
	),
};

export type ReforgeOptimizerOptions = {
	experimental?: true;
	statTooltips?: StatTooltipContent;
	statSelectionPresets?: UnitStatPresets[];
	// Allows you to enable breakpoint limits for Treshold type caps
	enableBreakpointLimits?: boolean;
	// Allows you to modify the stats before they are returned for the calculations
	// For example: Adding class specific Glyphs/Talents that are not added by the backend
	updateGearStatsModifier?: (baseStats: Stats) => Stats;
	// Allows you to get alternate default EPs
	// For example for Fury where you have SMF and TG EPs
	getEPDefaults?: (player: Player<any>) => Stats;
	// Allows you to modify default softCaps
	// For example you wish to add breakpoints for Berserking / Bloodlust if enabled
	updateSoftCaps?: (softCaps: StatCap[]) => StatCap[];
	// Allows you to specifiy additional information for the soft cap tooltips
	additionalSoftCapTooltipInformation?: StatTooltipContent;
	// Sets the default stat to be the highest for relative stat cap calculations
	// Defaults to Any
	defaultRelativeStatCap?: Stat | null;
};

// Used to force a particular proc from trinkets like Matrix Restabilizer and Apparatus of Khaz'goroth.
export class RelativeStatCap {
	readonly player: Player<any>;
	static relevantStats: Stat[] = [Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating];
	readonly forcedHighestStat: UnitStat;
	readonly constrainedStats: UnitStat[];
	readonly constraintKeys: string[];

	// Not comprehensive, add any other relevant offsets here as needed.
	static procTrinketOffsets: Map<Stat, Map<number, number>> = new Map([
		[
			Stat.StatCritRating,
			new Map([
				[69167, 460], // Vessel of Acceleration (H)
				[68995, 410], // Vessel of Acceleration (N)
			]),
		],
		[
			Stat.StatHasteRating,
			new Map([
				[69112, 1730], // The Hungerer (H)
				[68927, 1532], // The Hungerer (N)
			]),
		],
		[Stat.StatMasteryRating, new Map([])],
	]);

	static hasRoRo(player: Player<any>): boolean {
		return player.getGear().hasTrinketFromOptions([95802, 94532, 96546, 96174, 96918]);
	}

	constructor(forcedHighestStat: Stat, player: Player<any>, playerClass: Class) {
		if (!RelativeStatCap.relevantStats.includes(forcedHighestStat)) {
			throw new Error('Forced highest stat must be either Crit, Haste, or Mastery!');
		}
		this.player = player;
		this.forcedHighestStat = UnitStat.fromStat(forcedHighestStat);
		this.constrainedStats = RelativeStatCap.relevantStats.filter(stat => stat !== forcedHighestStat).map(stat => UnitStat.fromStat(stat));
		this.constraintKeys = this.constrainedStats.map(
			unitStat => this.forcedHighestStat.getShortName(playerClass) + 'Minus' + unitStat.getShortName(playerClass),
		);
	}

	updateCoefficients(coefficients: YalpsCoefficients, stat: Stat, amount: number) {
		if (!RelativeStatCap.relevantStats.includes(stat)) {
			return;
		}

		for (const [idx, constrainedStat] of this.constrainedStats.entries()) {
			const coefficientKey = this.constraintKeys[idx];
			const currentValue = coefficients.get(coefficientKey) || 0;

			if (this.forcedHighestStat.equalsStat(stat)) {
				coefficients.set(coefficientKey, currentValue + amount);
			} else if (constrainedStat.equalsStat(stat)) {
				coefficients.set(coefficientKey, currentValue - amount);
			}
		}

		if (stat != Stat.StatMasteryRating && this.forcedHighestStat.equalsStat(Stat.StatMasteryRating) && this.player.getSpec() == Spec.SpecFeralDruid) {
			const coefficientKey = 'HasteMinusCrit';
			const currentValue = coefficients.get(coefficientKey) || 0;

			if (stat == Stat.StatHasteRating) {
				coefficients.set(coefficientKey, currentValue + amount);
			} else {
				coefficients.set(coefficientKey, currentValue - amount);
			}
		}
	}

	updateConstraints(constraints: YalpsConstraints, gear: Gear, baseStats: Stats) {
		baseStats = baseStats.addStat(Stat.StatMasteryRating, -this.player.getBaseMastery() * Mechanics.MASTERY_RATING_PER_MASTERY_POINT);
		const raidBuffs = this.player.getRaid()?.getBuffs();
		// @TODO: Validate on PTR
		// Mastery raid buff does not count towards RoRo calculation
		if (raidBuffs && (raidBuffs.roarOfCourage || raidBuffs.blessingOfMight || raidBuffs.spiritBeastBlessing || raidBuffs.graceOfAir)) {
			baseStats = baseStats.addStat(Stat.StatMasteryRating, -Mechanics.RAID_BUFF_MASTERY_RATING);
		}

		for (const [idx, constrainedStat] of this.constrainedStats.entries()) {
			const weightedStatsArray = new Stats().withUnitStat(this.forcedHighestStat, 1).withUnitStat(constrainedStat, -1);
			let minReforgeContribution = 1 - baseStats.computeEP(weightedStatsArray);
			const procOffsetMap = RelativeStatCap.procTrinketOffsets.get(constrainedStat.getStat())!;

			for (const trinket of gear.getTrinkets()) {
				if (!trinket) {
					continue;
				}

				const trinketId = trinket.item.id;

				if (procOffsetMap.has(trinketId)) {
					minReforgeContribution += procOffsetMap.get(trinketId)!;
					break;
				}
			}

			constraints.set(this.constraintKeys[idx], greaterEq(minReforgeContribution));
		}

		if (this.forcedHighestStat.equalsStat(Stat.StatMasteryRating) && this.player.getSpec() == Spec.SpecFeralDruid) {
			const minReforgeContribution = baseStats.getStat(Stat.StatCritRating) - baseStats.getStat(Stat.StatHasteRating) + 1;
			constraints.set('HasteMinusCrit', greaterEq(minReforgeContribution));
		}
	}

	updateWeights(statWeights: Stats) {
		const smallestConstrainedEP = Math.min(statWeights.getUnitStat(this.constrainedStats[0]), statWeights.getUnitStat(this.constrainedStats[1]));
		return statWeights.withUnitStat(this.forcedHighestStat, Math.min(statWeights.getUnitStat(this.forcedHighestStat), smallestConstrainedEP - 0.01));
	}
}

export class ReforgeOptimizer {
	protected readonly simUI: IndividualSimUI<any>;
	protected readonly player: Player<any>;
	protected readonly playerClass: Class;
	protected readonly isExperimental: ReforgeOptimizerOptions['experimental'];
	protected readonly isHybridCaster: boolean;
	protected readonly isTankSpec: boolean;
	protected readonly sim: Sim;
	protected readonly defaults: IndividualSimUI<any>['individualConfig']['defaults'];
	protected getEPDefaults: ReforgeOptimizerOptions['getEPDefaults'];
	protected _statCaps: Stats = new Stats();
	protected breakpointLimits: Stats = new Stats();
	protected updateGearStatsModifier: ReforgeOptimizerOptions['updateGearStatsModifier'];
	protected _softCapsConfig: StatCap[];
	private useCustomEPValues = false;
	private useSoftCapBreakpoints = true;
	protected softCapBreakpoints: StatCap[] = [];
	protected updateSoftCaps: ReforgeOptimizerOptions['updateSoftCaps'];
	protected enableBreakpointLimits: ReforgeOptimizerOptions['enableBreakpointLimits'];
	protected statTooltips: StatTooltipContent = {};
	protected additionalSoftCapTooltipInformation: StatTooltipContent = {};
	protected statSelectionPresets: ReforgeOptimizerOptions['statSelectionPresets'];
	protected includeGems = false;
	protected includeEOTBPGemSocket = false;
	protected freezeItemSlots = false;
	protected frozenItemSlots = new Set<ItemSlot>();
	protected includeTimeout = true;
	protected undershootCaps = new Stats();
	protected previousGear: Gear | null = null;
	protected previousReforges = new Map<ItemSlot, ReforgeData>();
	protected currentReforges = new Map<ItemSlot, ReforgeData>();
	relativeStatCapStat: number = -1;
	relativeStatCap: RelativeStatCap | null = null;

	readonly includeGemsChangeEmitter = new TypedEvent<void>('IncludeGems');
	readonly includeEOTBPGemSocketChangeEmitter = new TypedEvent<void>('IncludeEOTBPGemSocket');
	readonly includeTimeoutChangeEmitter = new TypedEvent<void>('IncludeTimeout');
	readonly statCapsChangeEmitter = new TypedEvent<void>('StatCaps');
	readonly useCustomEPValuesChangeEmitter = new TypedEvent<void>('UseCustomEPValues');
	readonly useSoftCapBreakpointsChangeEmitter = new TypedEvent<void>('UseSoftCapBreakpoints');
	readonly softCapBreakpointsChangeEmitter = new TypedEvent<void>('SoftCapBreakpoints');
	readonly breakpointLimitsChangeEmitter = new TypedEvent<void>('BreakpointLimits');
	readonly freezeItemSlotsChangeEmitter = new TypedEvent<void>('FreezeItemSlots');
	readonly undershootCapsChangeEmitter = new TypedEvent<void>('UndershootCaps');
	readonly relativeStatCapStatChangeEmitter = new TypedEvent<void>('RelativeStatCapStat');

	// Emits when any of the above emitters emit.
	readonly changeEmitter: TypedEvent<void>;

	constructor(simUI: IndividualSimUI<any>, options?: ReforgeOptimizerOptions) {
		this.simUI = simUI;
		this.player = simUI.player;
		this.playerClass = this.player.getClass();
		this.isExperimental = options?.experimental;
		this.isHybridCaster = [Spec.SpecBalanceDruid, Spec.SpecShadowPriest, Spec.SpecElementalShaman, Spec.SpecMistweaverMonk].includes(this.player.getSpec());
		this.isTankSpec = this.player.getPlayerSpec().isTankSpec;
		this.sim = simUI.sim;
		this.defaults = simUI.individualConfig.defaults;
		this.getEPDefaults = options?.getEPDefaults;
		this.updateSoftCaps = options?.updateSoftCaps;
		this.updateGearStatsModifier = options?.updateGearStatsModifier;
		this._softCapsConfig = this.defaults.softCapBreakpoints || [];
		this.statTooltips = { ...STAT_TOOLTIPS, ...options?.statTooltips };
		this.additionalSoftCapTooltipInformation = { ...options?.additionalSoftCapTooltipInformation };
		this.statSelectionPresets = options?.statSelectionPresets;
		this._statCaps = this.defaults.statCaps || new Stats();
		this.enableBreakpointLimits = !!options?.enableBreakpointLimits;
		this.relativeStatCapStat = options?.defaultRelativeStatCap ?? -1;

		const startReforgeOptimizationEntry: ActionGroupItem = {
			label: i18n.t('sidebar.buttons.suggest_reforges.title'),
			cssClass: 'suggest-reforges-action-button flex-grow-1',
			onClick: async ({ currentTarget }) => {
				trackEvent({
					action: 'settings',
					category: 'reforging',
					label: 'suggest_start',
				});
				const button = currentTarget as HTMLButtonElement;
				if (button) {
					button.classList.add('loading');
					button.disabled = true;
				}

				const wasCM = simUI.player.getChallengeModeEnabled();
				try {
					performance.mark('reforge-optimization-start');
					if (wasCM) {
						simUI.player.setChallengeModeEnabled(TypedEvent.nextEventID(), false);
					}
					await this.optimizeReforges();
					this.onReforgeDone();
				} catch (error) {
					this.onReforgeError(error);
				} finally {
					if (wasCM) {
						simUI.player.setChallengeModeEnabled(TypedEvent.nextEventID(), true);
					}
					performance.mark('reforge-optimization-end');
					const completionTimeInMs = performance.measure(
						'reforge-optimization-measure',
						'reforge-optimization-start',
						'reforge-optimization-end',
					).duration;
					if (isDevMode()) console.log('Reforge optimization took:', `${completionTimeInMs.toFixed(2)}ms`);

					trackEvent({
						action: 'settings',
						category: 'reforging',
						label: 'suggest_duration',
						value: Math.ceil(completionTimeInMs / 1000),
					});
					if (button) {
						button.classList.remove('loading');
						button.disabled = false;
					}
				}
			},
		};

		const contextMenuEntry: ActionGroupItem = {
			cssClass: 'suggest-reforges-button-settings',
			children: (
				<>
					<i className="fas fa-cog" />
				</>
			),
		};

		const {
			group,
			children: [startReforgeOptimizationButton, contextMenuButton],
		} = simUI.addActionGroup([startReforgeOptimizationEntry, contextMenuEntry], {
			cssClass: clsx('suggest-reforges-settings-group', this.isExperimental && !this.player.sim.getShowExperimental() && 'hide'),
		});

		this.bindToggleExperimental(group);

		if (this.softCapsConfig?.length)
			tippy(startReforgeOptimizationButton, {
				theme: 'suggest-reforges-softcaps',
				placement: 'bottom',
				maxWidth: 310,
				interactive: true,
				onShow: instance => instance.setContent(this.buildReforgeButtonTooltip()),
			});

		tippy(contextMenuButton, {
			placement: 'bottom',
			content: i18n.t('sidebar.buttons.suggest_reforges.tooltip'),
		});

		this.buildContextMenu(contextMenuButton);

		this.changeEmitter = TypedEvent.onAny(
			[
				this.includeGemsChangeEmitter,
				this.includeEOTBPGemSocketChangeEmitter,
				this.includeTimeoutChangeEmitter,
				this.statCapsChangeEmitter,
				this.useCustomEPValuesChangeEmitter,
				this.useSoftCapBreakpointsChangeEmitter,
				this.softCapBreakpointsChangeEmitter,
				this.breakpointLimitsChangeEmitter,
				this.freezeItemSlotsChangeEmitter,
				this.undershootCapsChangeEmitter,
				this.relativeStatCapStatChangeEmitter,
			],
			'ReforgeSettingsChange',
		);

		TypedEvent.onAny([this.useCustomEPValuesChangeEmitter, this.player.epWeightsChangeEmitter, this.statCapsChangeEmitter]).on(eventID => {
			if (this.useCustomEPValues && (this.player.hasCustomEPWeights() || !this._statCaps.equals(this.defaults.statCaps || new Stats()))) {
				this.setUseSoftCapBreakpoints(eventID, false);
			}
		});
	}

	private bindToggleExperimental(element: Element) {
		const toggle = () => element.classList[this.isExperimental && !this.player.sim.getShowExperimental() ? 'add' : 'remove']('hide');
		toggle();
		this.player.sim.showExperimentalChangeEmitter.on(() => {
			toggle();
		});
	}

	get softCapsConfig() {
		return this.updateSoftCaps?.(StatCap.cloneSoftCaps(this._softCapsConfig)) || this._softCapsConfig;
	}

	get softCapsConfigWithLimits() {
		if (!this.enableBreakpointLimits || !this.useSoftCapBreakpoints) return this.softCapsConfig;

		const softCaps = StatCap.cloneSoftCaps(this.softCapsConfig);
		for (const [unitStat, limit] of this.breakpointLimits.asUnitStatArray()) {
			if (!limit) continue;
			const config = softCaps.find(config => config.unitStat.equals(unitStat));
			const breakpointLimitExists = config?.breakpoints.some(breakpoint => breakpoint == limit);
			if (config && breakpointLimitExists) {
				config.breakpoints = config.breakpoints.filter(breakpoint => breakpoint <= limit);
				if (config.capType === StatCapType.TypeSoftCap) {
					config.postCapEPs = config.postCapEPs.slice(0, config.breakpoints.length);
				}
			}
		}
		return softCaps;
	}

	get preCapEPs(): Stats {
		let weights = this.player.getEpWeights();

		if (!this.useCustomEPValues) {
			if (this.getEPDefaults) {
				weights = this.getEPDefaults?.(this.player);
			} else if (!this.player.hasCustomEPWeights()) {
				weights = this.defaults.epWeights;
			}
		}

		// Replace Spirit EP for hybrid casters with a small value in order to break ties between Spirit and Hit Reforges
		if (this.isHybridCaster) {
			weights = weights.withStat(Stat.StatSpirit, 0.01);
		}

		return weights;
	}

	// Checks that school-specific weights for Rating stats are set whenever there is a school-specific stat cap configured, and ensures that the
	// EPs for such stats are not double counted.
	static checkWeights(weights: Stats, reforgeCaps: Stats, reforgeSoftCaps: StatCap[]): Stats {
		let validatedWeights = weights;

		// Loop through Hit/Crit/Haste pure Rating stats.
		for (const parentStat of [Stat.StatHitRating, Stat.StatCritRating, Stat.StatHasteRating]) {
			const children = UnitStat.getChildren(parentStat);
			const specificSchoolWeights = children.map(childStat => weights.getPseudoStat(childStat));

			// If any of the children have non-zero EP, then set pure Rating EP
			// to 0 and continue.
			if (specificSchoolWeights.some(weight => weight !== 0)) {
				validatedWeights = validatedWeights.withStat(parentStat, 0);
				continue;
			}

			// If all children have 0 EP, then loop through children and check whether a cap has been configured for that child.
			for (const childStat of children) {
				if (pseudoStatIsCapped(childStat, reforgeCaps, reforgeSoftCaps)) {
					// The first time a cap is detected, set EP for that child to re-scaled parent Rating EP, set parent Rating EP
					// to 0, and break.
					const rescaledWeight = UnitStat.fromPseudoStat(childStat).convertPercentToRating(weights.getStat(parentStat));
					validatedWeights = validatedWeights.withPseudoStat(childStat, rescaledWeight!);
					validatedWeights = validatedWeights.withStat(parentStat, 0);
					break;
				}
			}
		}

		return validatedWeights;
	}

	static includesCappedStat(coefficients: YalpsCoefficients, reforgeCaps: Stats, reforgeSoftCaps: StatCap[]): boolean {
		for (const coefficientKey of coefficients.keys()) {
			if (coefficientKey.includes('PseudoStat')) {
				const statKey = PseudoStat[coefficientKey as keyof typeof PseudoStat];

				if (pseudoStatIsCapped(statKey, reforgeCaps, reforgeSoftCaps)) {
					return true;
				}
			} else if (coefficientKey.includes('Stat')) {
				const statKey = Stat[coefficientKey as keyof typeof Stat];

				if (statIsCapped(statKey, reforgeCaps, reforgeSoftCaps)) {
					return true;
				}
			} else if (coefficientKey.includes('Minus')) {
				return true;
			}
		}

		return false;
	}

	static getCappedStatKeys(coefficients: YalpsCoefficients, reforgeCaps: Stats, reforgeSoftCaps: StatCap[]): string[] {
		const cappedStatKeys: string[] = [];

		for (const coefficientKey of coefficients.keys()) {
			if (coefficientKey.includes('PseudoStat')) {
				const statKey = PseudoStat[coefficientKey as keyof typeof PseudoStat];

				if (pseudoStatIsCapped(statKey, reforgeCaps, reforgeSoftCaps)) {
					cappedStatKeys.push(coefficientKey);
				}
			} else if (coefficientKey.includes('Stat')) {
				const statKey = Stat[coefficientKey as keyof typeof Stat];

				if (statIsCapped(statKey, reforgeCaps, reforgeSoftCaps)) {
					cappedStatKeys.push(coefficientKey);
				}
			}
		}

		return cappedStatKeys;
	}

	buildReforgeButtonTooltip() {
		return (
			<>
				<p>{i18n.t('sidebar.buttons.suggest_reforges.breakpoints_implemented')}</p>
				<table className="w-100">
					<tbody>
						{this.softCapsConfigWithLimits?.map(({ unitStat, breakpoints, capType, postCapEPs }, index) => (
							<>
								<tr>
									<th className="text-nowrap" colSpan={2}>
										{unitStat.getShortName(this.playerClass)}
									</th>
									<td className="text-end">{statCapTypeNames.get(capType)}</td>
								</tr>
								{this.additionalSoftCapTooltipInformation[unitStat.getRootStat()] && (
									<>
										<tr>
											<td colSpan={3}>{this.additionalSoftCapTooltipInformation[unitStat.getRootStat()]?.()}</td>
										</tr>
										<tr>
											<td colSpan={3} className="pb-2"></td>
										</tr>
									</>
								)}
								<tr>
									<th className="text-end">
										<em>%</em>
									</th>
									<th colSpan={2} className="text-nowrap text-end">
										<em>{i18n.t('sidebar.buttons.suggest_reforges.post_cap_ep')}</em>
									</th>
								</tr>
								{breakpoints.map((breakpoint, breakpointIndex) => (
									<tr>
										<td className="text-end">{this.breakpointValueToDisplayPercentage(breakpoint, unitStat)}</td>
										<td colSpan={2} className="text-end">
											{unitStat
												.convertEpToRatingScale(capType === StatCapType.TypeThreshold ? postCapEPs[0] : postCapEPs[breakpointIndex])
												.toFixed(2)}
										</td>
									</tr>
								))}
								{index !== this.softCapsConfigWithLimits.length - 1 && (
									<>
										<tr>
											<td colSpan={3} className="border-bottom pb-2"></td>
										</tr>
										<tr>
											<td colSpan={3} className="pb-2"></td>
										</tr>
									</>
								)}
							</>
						))}
					</tbody>
				</table>
			</>
		);
	}

	setStatCaps(eventID: EventID, newStatCaps: Stats) {
		this._statCaps = newStatCaps;
		this.statCapsChangeEmitter.emit(eventID);
	}

	get statCaps() {
		return this.useCustomEPValues ? this._statCaps : this.defaults.statCaps || new Stats();
	}

	setUseCustomEPValues(eventID: EventID, newUseCustomEPValues: boolean) {
		if (newUseCustomEPValues !== this.useCustomEPValues) {
			this.useCustomEPValues = newUseCustomEPValues;
			this.useCustomEPValuesChangeEmitter.emit(eventID);
		}
	}

	setUseSoftCapBreakpoints(eventID: EventID, newUseSoftCapBreakpoints: boolean) {
		if (newUseSoftCapBreakpoints !== this.useSoftCapBreakpoints) {
			this.useSoftCapBreakpoints = newUseSoftCapBreakpoints;
			this.useSoftCapBreakpointsChangeEmitter.emit(eventID);
		}
	}

	setBreakpointLimits(eventID: EventID, newLimits: Stats) {
		this.breakpointLimits = newLimits;
		this.breakpointLimitsChangeEmitter.emit(eventID);
	}

	setSoftCapBreakpoints(eventID: EventID, newSoftCapBreakpoints: StatCap[]) {
		this.softCapBreakpoints = newSoftCapBreakpoints;
		this.softCapBreakpointsChangeEmitter.emit(eventID);
	}
	setRelativeStatCap(eventID: EventID, newValue: number) {
		this.relativeStatCapStat = newValue;
		if (this.relativeStatCapStat === -1) {
			this.relativeStatCap = null;
		} else {
			this.relativeStatCap = new RelativeStatCap(this.relativeStatCapStat, this.player, this.playerClass);
		}

		this.relativeStatCapStatChangeEmitter.emit(eventID);
	}

	setIncludeGems(eventID: EventID, newValue: boolean) {
		if (this.includeGems !== newValue) {
			this.includeGems = newValue;

			if (newValue) {
				this.setIncludeTimeout(eventID, true);
			}

			this.includeGemsChangeEmitter.emit(eventID);
		}
	}

	setIncludeEOTBPGemSocket(eventID: EventID, newValue: boolean) {
		if (this.includeEOTBPGemSocket !== newValue) {
			this.includeEOTBPGemSocket = newValue;
			this.includeEOTBPGemSocketChangeEmitter.emit(eventID);
		}
	}

	setFreezeItemSlots(eventID: EventID, newValue: boolean) {
		if (this.freezeItemSlots !== newValue) {
			this.freezeItemSlots = newValue;
			this.frozenItemSlots.clear();
			this.freezeItemSlotsChangeEmitter.emit(eventID);
		}
	}

	setFrozenItemSlot(eventID: EventID, slot: ItemSlot, frozen: boolean) {
		if (this.getFrozenItemSlot(slot) !== frozen) {
			this.frozenItemSlots[frozen ? 'add' : 'delete'](slot);
			this.freezeItemSlotsChangeEmitter.emit(eventID);
		}
	}

	// Sets all frozen item slots at once
	setFrozenItemSlots(eventID: EventID, slots: ItemSlot[]) {
		this.frozenItemSlots.clear();
		slots.forEach(slot => this.frozenItemSlots.add(slot));
		this.freezeItemSlotsChangeEmitter.emit(eventID);
	}

	getFrozenItemSlot(slot: ItemSlot): boolean {
		return this.frozenItemSlots.has(slot);
	}

	setIncludeTimeout(eventID: EventID, newValue: boolean) {
		if (this.includeTimeout !== newValue) {
			this.includeTimeout = newValue;
			this.includeTimeoutChangeEmitter.emit(eventID);
		}
	}

	buildContextMenu(button: HTMLButtonElement) {
		const instance = tippy(button, {
			interactive: true,
			trigger: 'click',
			theme: 'reforge-optimiser-popover',
			placement: 'right-start',
			onShow: instance => {
				trackPageView('Reforge Settings', 'reforge-settings');

				const useCustomEPValuesInput = new BooleanPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-enable-custom-ep-weights',
					label: i18n.t('sidebar.buttons.suggest_reforges.use_custom'),
					inline: true,
					changedEvent: () => this.useCustomEPValuesChangeEmitter,
					getValue: () => this.useCustomEPValues,
					setValue: (eventID, _player, newValue) => {
						trackEvent({
							action: 'settings',
							category: 'reforging',
							label: 'use_custom_ep',
							value: newValue,
						});
						this.setUseCustomEPValues(eventID, newValue);
					},
				});
				let useSoftCapBreakpointsInput: BooleanPicker<Player<any>> | null = null;
				if (this.softCapsConfig?.length) {
					useSoftCapBreakpointsInput = new BooleanPicker(null, this.player, {
						extraCssClasses: ['mb-2'],
						id: 'reforge-optimizer-enable-soft-cap-breakpoints',
						label: i18n.t('sidebar.buttons.suggest_reforges.use_soft_cap_breakpoints'),
						inline: true,
						changedEvent: () => this.useSoftCapBreakpointsChangeEmitter,
						getValue: () => this.useSoftCapBreakpoints,
						setValue: (eventID, _player, newValue) => {
							trackEvent({
								action: 'settings',
								category: 'reforging',
								label: 'softcap_breakpoints',
								value: newValue,
							});
							this.setUseSoftCapBreakpoints(eventID, newValue);
						},
					});
				}

				const forcedProcInput = new EnumPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-force-stat-proc',
					label: i18n.t('sidebar.buttons.suggest_reforges.force_stat_proc'),
					defaultValue: this.relativeStatCapStat,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.any'), value: -1 },
						...[...RelativeStatCap.relevantStats].map(stat => {
							return {
								name: UnitStat.fromStat(stat).getShortName(this.playerClass),
								value: stat,
							};
						}),
					],
					changedEvent: () => TypedEvent.onAny([this.relativeStatCapStatChangeEmitter, this.player.gearChangeEmitter]),
					getValue: () => {
						return this.relativeStatCapStat;
					},
					setValue: (_eventID, _player, newValue) => {
						this.setRelativeStatCap(TypedEvent.nextEventID(), newValue);
					},
					showWhen: () => {
						const canEnable = RelativeStatCap.hasRoRo(this.player);

						if (!canEnable || this.relativeStatCapStat === -1) {
							this.relativeStatCap = null;
						} else if (!this.relativeStatCap && this.relativeStatCapStat) {
							this.relativeStatCap = new RelativeStatCap(this.relativeStatCapStat, this.player, this.playerClass);
						}

						return canEnable;
					},
				});

				const includeGemsInput = new BooleanPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-include-gems',
					label: i18n.t('sidebar.buttons.suggest_reforges.include_gems'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.optimize_gems_tooltip'),
					inline: true,
					changedEvent: () => this.includeGemsChangeEmitter,
					getValue: () => this.includeGems,
					setValue: (eventID, _player, newValue) => {
						trackEvent({
							action: 'settings',
							category: 'reforging',
							label: 'include_gems',
							value: newValue,
						});
						TypedEvent.freezeAllAndDo(() => {
							this.setIncludeGems(eventID, newValue);
							this.setIncludeEOTBPGemSocket(eventID, this.player.sim.getPhase() >= 2);
						});
					},
				});

				const includeEOTBPGemSocket = new BooleanPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-include-eotbp-socket',
					label: i18n.t('sidebar.buttons.suggest_reforges.include_eotbp_socket'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.include_eotbp_socket_tooltip'),
					inline: true,
					changedEvent: () =>
						TypedEvent.onAny([this.includeGemsChangeEmitter, this.includeEOTBPGemSocketChangeEmitter, this.player.gearChangeEmitter]),
					getValue: () => this.includeEOTBPGemSocket,
					showWhen: () => this.includeGems && this.player.hasEotBPItemEquipped(),
					setValue: (eventID, _player, newValue) => {
						this.setIncludeEOTBPGemSocket(eventID, newValue);
					},
				});

				const freezeItemSlotsInput = new BooleanPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-freeze-item-slots',
					label: i18n.t('sidebar.buttons.suggest_reforges.freeze_item_slots'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.freeze_item_slots_tooltip'),
					inline: true,
					changedEvent: () => this.freezeItemSlotsChangeEmitter,
					getValue: () => this.freezeItemSlots,
					setValue: (eventID, _player, newValue) => {
						trackEvent({
							action: 'settings',
							category: 'reforging',
							label: 'freeze_item_slots',
							value: newValue,
						});
						this.setFreezeItemSlots(eventID, newValue);
					},
				});

				const includeTimeoutInput = new BooleanPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-include-timeout',
					label: i18n.t('sidebar.buttons.suggest_reforges.limit_execution_time'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.limit_execution_time_tooltip'),
					inline: true,
					changedEvent: () => TypedEvent.onAny([this.includeTimeoutChangeEmitter, this.includeGemsChangeEmitter]),
					getValue: () => this.includeTimeout,
					setValue: (eventID, _player, newValue) => {
						this.setIncludeTimeout(eventID, newValue);
					},
				});

				const descriptionRef = ref<HTMLParagraphElement>();
				instance.setContent(
					<>
						{useCustomEPValuesInput.rootElem}
						<div ref={descriptionRef} className={clsx('mb-0', this.useCustomEPValues && 'hide')}>
							<p>{i18n.t('sidebar.buttons.suggest_reforges.enable_modification')}</p>
							<p>{i18n.t('sidebar.buttons.suggest_reforges.modify_in_editor')}</p>
							<p>{i18n.t('sidebar.buttons.suggest_reforges.hard_cap_info')}</p>
						</div>
						{this.buildCapsList({
							useCustomEPValuesInput: useCustomEPValuesInput,
							description: descriptionRef.value!,
						})}
						{useSoftCapBreakpointsInput?.rootElem}
						{forcedProcInput.rootElem}
						{this.buildSoftCapBreakpointsLimiter({ useSoftCapBreakpointsInput })}
						{includeGemsInput.rootElem}
						{includeEOTBPGemSocket.rootElem}
						{includeTimeoutInput.rootElem}
						{freezeItemSlotsInput.rootElem}
						{this.buildFrozenSlotsInputs()}
						{this.buildEPWeightsToggle({ useCustomEPValuesInput: useCustomEPValuesInput })}
					</>,
				);
			},
			onHidden: () => {
				instance.setContent(<></>);
			},
		});
	}

	buildFrozenSlotsInputs() {
		const allSlots = this.player.getGear().getItemSlots();
		const numRows = Math.floor(allSlots.length / 2) + 1;
		const slotsByRow: ItemSlot[][] = [];

		for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
			slotsByRow.push(allSlots.slice(rowIdx * 2, (rowIdx + 1) * 2));
		}

		const tableRef = ref<HTMLTableElement>();
		const content = (
			<table className={clsx('mb-2', { 'd-none': !this.freezeItemSlots })} ref={tableRef}>
				{slotsByRow.map(slots => {
					const rowRef = ref<HTMLTableRowElement>();
					const row = (
						<tr ref={rowRef}>
							{slots.map(slot => {
								const picker = new BooleanPicker(null, this.player, {
									id: 'reforge-optimizer-freeze-' + ItemSlot[slot],
									label: translateSlotName(slot),
									inline: true,
									changedEvent: () => this.freezeItemSlotsChangeEmitter,
									getValue: () => this.getFrozenItemSlot(slot) || false,
									setValue: (eventID, _player, newValue) => {
										this.setFrozenItemSlot(eventID, slot, newValue);
									},
								});
								const column = <td>{picker.rootElem}</td>;
								return column;
							})}
						</tr>
					);
					return row;
				})}
			</table>
		);

		this.freezeItemSlotsChangeEmitter.on(() => {
			tableRef.value?.classList[this.freezeItemSlots ? 'remove' : 'add']('d-none');
		});

		return content;
	}

	buildCapsList({ useCustomEPValuesInput, description }: { useCustomEPValuesInput: BooleanPicker<Player<any>>; description: HTMLElement }) {
		const sharedInputConfig: Pick<NumberPickerConfig<Player<any>>, 'changedEvent'> = {
			changedEvent: _ => TypedEvent.onAny([this.useSoftCapBreakpointsChangeEmitter, this.statCapsChangeEmitter]),
		};

		const tableRef = ref<HTMLTableElement>();
		const statCapTooltipRef = ref<HTMLButtonElement>();
		const defaultStatCapsButtonRef = ref<HTMLButtonElement>();

		const content = (
			<table ref={tableRef} className={clsx('reforge-optimizer-stat-cap-table mb-2', !this.useCustomEPValues && 'hide')}>
				<thead>
					<tr>
						<th colSpan={4} className="pb-3">
							<div className="d-flex">
								<h6 className="content-block-title mb-0 me-1">{i18n.t('sidebar.buttons.suggest_reforges.edit_stat_caps')}</h6>
								<button ref={statCapTooltipRef} className="d-inline">
									<i className="fa-regular fa-circle-question" />
								</button>
								<button
									ref={defaultStatCapsButtonRef}
									className="d-inline ms-auto"
									onclick={() => this.setStatCaps(TypedEvent.nextEventID(), this.defaults.statCaps || new Stats())}>
									<i className="fas fa-arrow-rotate-left" />
								</button>
							</div>
						</th>
					</tr>
					<tr>
						<th>{i18n.t('sidebar.buttons.suggest_reforges.stat')}</th>
						<th colSpan={3} className="text-end">
							%
						</th>
						<th colSpan={1} className="text-start">
							Max?
						</th>
					</tr>
				</thead>
				<tbody>
					{this.simUI.individualConfig.displayStats.map(unitStat => {
						if (!unitStat.hasRootStat()) return;
						const rootStat = unitStat.getRootStat();
						if (!INCLUDED_STATS.includes(rootStat)) return;

						const listElementRef = ref<HTMLTableRowElement>();
						const statName = unitStat.getShortName(this.player.getClass());

						const sharedStatInputConfig: Pick<NumberPickerConfig<Player<any>>, 'getValue' | 'setValue'> = {
							getValue: () => {
								return this.toVisualUnitStatPercentage(this.statCaps.getUnitStat(unitStat), unitStat);
							},
							setValue: (_eventID, _player, newValue) => {
								this.setStatCaps(TypedEvent.nextEventID(), this.statCaps.withUnitStat(unitStat, newValue));
							},
						};

						const percentagePicker = new NumberPicker(null, this.player, {
							id: `reforge-optimizer-${statName}-percentage`,
							float: true,
							maxDecimalDigits: 5,
							showZeroes: false,
							positive: true,
							extraCssClasses: ['mb-0'],
							enableWhen: () => this.isAllowedToOverrideStatCaps || !this.softCapsConfig.some(config => config.unitStat.equals(unitStat)),
							...sharedInputConfig,
							...sharedStatInputConfig,
						});

						const undershootPicker = new BooleanPicker(null, this.player, {
							id: `reforge-optimizer-${statName}-undershoot`,
							label: '',
							inline: false,
							changedEvent: () => this.undershootCapsChangeEmitter,
							getValue: () => this.undershootCaps.getUnitStat(unitStat) > 0,
							setValue: (_eventID, _player, newValue) => {
								this.undershootCaps = this.undershootCaps.withUnitStat(unitStat, newValue ? 1 : 0);
							},
						});

						const statPresets = this.statSelectionPresets?.find(entry => entry.unitStat.equals(unitStat))?.presets;

						const presets = !!statPresets
							? new EnumPicker(null, this.player, {
									id: `reforge-optimizer-${statName}-presets`,
									extraCssClasses: ['mb-0'],
									label: '',
									values: [
										{ name: i18n.t('sidebar.buttons.suggest_reforges.select_preset'), value: 0 },
										...[...statPresets.keys()].map(key => {
											const percentValue = statPresets.get(key)!;

											return {
												name: `${key} - ${percentValue.toFixed(2)}%`,
												value: percentValue,
											};
										}),
									].sort((a, b) => a.value - b.value),
									enableWhen: () => this.isAllowedToOverrideStatCaps || !this.softCapsConfig.some(config => config.unitStat.equals(unitStat)),
									...sharedInputConfig,
									...sharedStatInputConfig,
								})
							: null;

						const tooltipText = this.statTooltips[rootStat];
						const statTooltipRef = ref<HTMLButtonElement>();

						const row = (
							<>
								<tr ref={listElementRef} className="reforge-optimizer-stat-cap-item">
									<td>
										<div className="reforge-optimizer-stat-cap-item-label">
											{statName}{' '}
											{tooltipText && (
												<button ref={statTooltipRef} className="d-inline">
													<i className="fa-regular fa-circle-question" />
												</button>
											)}
										</div>
									</td>
									<td colSpan={3}>{percentagePicker.rootElem}</td>
									<td colSpan={1} className="text-end">
										{undershootPicker.rootElem}
									</td>
								</tr>
								{presets && (
									<tr>
										<td></td>
										<td colSpan={3}>{presets.rootElem}</td>
									</tr>
								)}
							</>
						);

						const tooltip = tooltipText
							? tippy(statTooltipRef.value!, {
									content: tooltipText,
								})
							: null;

						useCustomEPValuesInput.addOnDisposeCallback(() => tooltip?.destroy());

						return row;
					})}
				</tbody>
			</table>
		);

		if (statCapTooltipRef.value) {
			const tooltip = tippy(statCapTooltipRef.value, {
				content: i18n.t('sidebar.buttons.suggest_reforges.stat_caps_tooltip'),
			});
			useCustomEPValuesInput.addOnDisposeCallback(() => tooltip.destroy());
		}
		if (defaultStatCapsButtonRef.value) {
			const tooltip = tippy(defaultStatCapsButtonRef.value, {
				content: i18n.t('sidebar.buttons.suggest_reforges.reset_to_defaults'),
			});
			useCustomEPValuesInput.addOnDisposeCallback(() => tooltip.destroy());
		}

		const event = this.useCustomEPValuesChangeEmitter.on(() => {
			tableRef.value?.classList[this.useCustomEPValues ? 'remove' : 'add']('hide');
			description?.classList[!this.useCustomEPValues ? 'remove' : 'add']('hide');
		});

		useCustomEPValuesInput.addOnDisposeCallback(() => {
			content.remove();
			event.dispose();
			this.undershootCaps = new Stats();
		});

		return content;
	}

	buildEPWeightsToggle({ useCustomEPValuesInput }: { useCustomEPValuesInput: BooleanPicker<Player<any>> }) {
		const extraCssClasses = ['mt-3'];
		if (!this.useCustomEPValues) extraCssClasses.push('hide');
		const savedEpWeights = renderSavedEPWeights(null, this.simUI, { extraCssClasses, loadOnly: true });
		const event = this.useCustomEPValuesChangeEmitter.on(() => {
			const isUsingCustomEPValues = this.useCustomEPValues;
			savedEpWeights.rootElem?.classList[isUsingCustomEPValues ? 'remove' : 'add']('hide');
		});

		useCustomEPValuesInput.addOnDisposeCallback(() => {
			savedEpWeights.dispose();
			savedEpWeights.rootElem.remove();
			event.dispose();
		});

		return (
			<>
				{savedEpWeights.rootElem}
				{this.simUI.epWeightsModal && (
					<button
						className="btn btn-outline-primary mt-2"
						onclick={() => {
							this.simUI.epWeightsModal?.open();
							hideAll();
						}}>
						{i18n.t('sidebar.buttons.suggest_reforges.edit_weights')}
					</button>
				)}
			</>
		);
	}

	buildSoftCapBreakpointsLimiter({ useSoftCapBreakpointsInput }: { useSoftCapBreakpointsInput: BooleanPicker<Player<any>> | null }) {
		if (!this.enableBreakpointLimits || !useSoftCapBreakpointsInput) return null;

		const tableRef = ref<HTMLTableElement>();
		const breakpointsLimitTooltipRef = ref<HTMLButtonElement>();

		const content = (
			<table ref={tableRef} className={clsx('reforge-optimizer-stat-cap-table mb-2', !this.useSoftCapBreakpoints && 'hide')}>
				<thead>
					<tr>
						<th colSpan={3} className="pb-3">
							<div className="d-flex">
								<h6 className="content-block-title mb-0 me-1">{i18n.t('sidebar.buttons.suggest_reforges.breakpoint_limit')}</h6>
								<button ref={breakpointsLimitTooltipRef} className="d-inline">
									<i className="fa-regular fa-circle-question" />
								</button>
							</div>
						</th>
					</tr>
				</thead>
				<tbody>
					{this.softCapsConfig
						.filter(
							config =>
								(config.capType === StatCapType.TypeThreshold || config.capType === StatCapType.TypeSoftCap) && config.breakpoints.length > 1,
						)
						.map(({ breakpoints, unitStat }) => {
							if (!unitStat.hasRootStat()) return;
							const rootStat = unitStat.getRootStat();
							if (!INCLUDED_STATS.includes(rootStat)) return;

							const listElementRef = ref<HTMLTableRowElement>();
							const statName = unitStat.getShortName(this.player.getClass());
							const picker = breakpoints
								? new EnumPicker(null, this.player, {
										id: `reforge-optimizer-${statName}-presets`,
										extraCssClasses: ['mb-0'],
										label: '',
										values: [
											{ name: i18n.t('sidebar.buttons.suggest_reforges.no_limit_set'), value: 0 },
											...breakpoints.map(breakpoint => ({
												name: `${this.breakpointValueToDisplayPercentage(breakpoint, unitStat)}%`,
												value: breakpoint,
											})),
										].sort((a, b) => a.value - b.value),
										changedEvent: _ => TypedEvent.onAny([this.useSoftCapBreakpointsChangeEmitter]),
										getValue: () => {
											const breakpointLimits = this.breakpointLimits;
											let limit = breakpointLimits.getUnitStat(unitStat);
											if (!breakpoints.some(breakpoint => breakpoint == limit)) {
												limit = 0;
											}

											return limit;
										},
										setValue: (eventID, _player, newValue) => {
											this.setBreakpointLimits(eventID, this.breakpointLimits.withUnitStat(unitStat, newValue));
										},
									})
								: null;

							if (!picker?.rootElem) return null;

							const row = (
								<>
									<tr ref={listElementRef} className="reforge-optimizer-stat-cap-item">
										<td>
											<div className="reforge-optimizer-stat-cap-item-label">{statName}</div>
										</td>
										<td colSpan={2}>{picker.rootElem}</td>
									</tr>
								</>
							);

							return row;
						})}
				</tbody>
			</table>
		);

		if (breakpointsLimitTooltipRef.value) {
			const tooltip = tippy(breakpointsLimitTooltipRef.value, {
				content: i18n.t('sidebar.buttons.suggest_reforges.breakpoint_limit_tooltip'),
			});
			useSoftCapBreakpointsInput.addOnDisposeCallback(() => tooltip.destroy());
		}

		const event = this.useSoftCapBreakpointsChangeEmitter.on(() => {
			const isUsingBreakpoints = this.useSoftCapBreakpoints;
			tableRef.value?.classList[isUsingBreakpoints ? 'remove' : 'add']('hide');
		});

		useSoftCapBreakpointsInput.addOnDisposeCallback(() => {
			content.remove();
			event?.dispose();
		});

		return content;
	}

	get isAllowedToOverrideStatCaps() {
		return !(this.useSoftCapBreakpoints && this.softCapsConfig);
	}

	get processedStatCaps() {
		let statCaps = this.statCaps;
		if (!this.isAllowedToOverrideStatCaps)
			this.softCapsConfigWithLimits.forEach(({ unitStat }) => {
				statCaps = statCaps.withUnitStat(unitStat, 0);
			});

		return statCaps;
	}

	async optimizeReforges(batchRun?: boolean) {
		if (isDevMode()) console.log('Starting Reforge optimization...');

		// First, clear all existing Reforges
		if (isDevMode()) {
			console.log('Clearing existing Reforges...');
			console.log('The following slots will not be cleared:');
			console.log(Array.from(this.frozenItemSlots.keys()).filter(key => this.getFrozenItemSlot(key)));
		}
		this.previousGear = this.player.getGear();
		this.previousReforges = this.previousGear.getAllReforges();
		let baseGear = this.previousGear.withoutReforges(this.player.canDualWield2H(), this.frozenItemSlots);

		if (this.includeGems) {
			baseGear = baseGear.withoutGems(this.player.canDualWield2H(), this.frozenItemSlots, true);
		}

		const baseStats = await this.updateGear(baseGear);

		// Compute effective stat caps for just the Reforge contribution
		let reforgeCaps = baseStats.computeStatCapsDelta(this.processedStatCaps);

		if (this.player.getSpec() == Spec.SpecGuardianDruid) {
			reforgeCaps = reforgeCaps.withPseudoStat(
				PseudoStat.PseudoStatMeleeHastePercent,
				reforgeCaps.getPseudoStat(PseudoStat.PseudoStatMeleeHastePercent) / 1.5,
			);
		}

		if (isDevMode()) {
			console.log('Stat caps for Reforge contribution:');
			console.log(reforgeCaps);
		}

		// Do the same for any soft cap breakpoints that were configured
		const reforgeSoftCaps = this.computeReforgeSoftCaps(baseStats);

		// Perform any required processing on the pre-cap EPs to make them internally consistent with the
		// configured hard caps and soft caps.
		let validatedWeights = ReforgeOptimizer.checkWeights(this.preCapEPs, reforgeCaps, reforgeSoftCaps);

		if (this.relativeStatCap) {
			validatedWeights = this.relativeStatCap.updateWeights(validatedWeights);
		}

		// Set up YALPS model
		const variables = this.buildYalpsVariables(baseGear, validatedWeights, reforgeCaps, reforgeSoftCaps);
		const constraints = this.buildYalpsConstraints(baseGear, baseStats);

		// Solve in multiple passes to enforce caps
		await this.solveModel(
			baseGear,
			validatedWeights,
			reforgeCaps,
			reforgeSoftCaps,
			variables,
			constraints,
			5000000,
			(this.includeTimeout ? (this.relativeStatCap ? 120 : 30) : 3600) / (batchRun ? 4 : 1),
		);
		this.currentReforges = this.player.getGear().getAllReforges();
	}

	async updateGear(gear: Gear): Promise<Stats> {
		await this.player.setGearAsync(TypedEvent.nextEventID(), gear);
		let baseStats = Stats.fromProto(this.player.getCurrentStats().finalStats);
		baseStats = baseStats.addStat(Stat.StatMasteryRating, this.player.getBaseMastery() * Mechanics.MASTERY_RATING_PER_MASTERY_POINT);
		if (this.updateGearStatsModifier) baseStats = this.updateGearStatsModifier(baseStats);
		return baseStats;
	}

	computeReforgeSoftCaps(baseStats: Stats): StatCap[] {
		const reforgeSoftCaps: StatCap[] = [];

		if (!this.isAllowedToOverrideStatCaps) {
			this.softCapsConfigWithLimits.slice().forEach(config => {
				let weights = config.postCapEPs.slice();
				const relativeBreakpoints = [];

				for (const breakpoint of config.breakpoints) {
					relativeBreakpoints.push(baseStats.computeGapToCap(config.unitStat, breakpoint));
				}

				// For stats that are configured as thresholds rather than soft caps,
				// reverse the order of evaluation of the breakpoints so that the
				// largest relevant threshold is always targeted. Likewise, use a
				// single value for the post-cap EP for these stats, which should be
				// interpreted (and computed) as the residual stat value just after
				// passing a threshold discontinuity.
				if (config.capType == StatCapType.TypeThreshold) {
					relativeBreakpoints.reverse();
					weights = Array(relativeBreakpoints.length).fill(weights[0]);
				}

				reforgeSoftCaps.push(new StatCap(config.unitStat, relativeBreakpoints, config.capType, weights));
			});
		}

		return reforgeSoftCaps;
	}

	buildYalpsVariables(gear: Gear, preCapEPs: Stats, reforgeCaps: Stats, reforgeSoftCaps: StatCap[]): YalpsVariables {
		const variables = new Map<string, YalpsCoefficients>();
		const epStats = this.simUI.individualConfig.epStats;
		const gemsToInclude = this.buildGemOptions(preCapEPs, reforgeCaps, reforgeSoftCaps);

		for (const slot of gear.getItemSlots()) {
			const item = gear.getEquippedItem(slot);

			if (!item || this.getFrozenItemSlot(slot)) {
				continue;
			}

			const scaledItem = item.withDynamicStats();

			for (const reforgeData of this.player.getAvailableReforgings(scaledItem)) {
				if (!epStats.includes(reforgeData.toStat) && reforgeData.toStat != Stat.StatExpertiseRating) {
					continue;
				}

				const variableKey = `${slot}_${reforgeData.id}`;
				const coefficients = new Map<string, number>();
				coefficients.set(ItemSlot[slot], 1);
				this.applyReforgeStat(coefficients, reforgeData.fromStat, reforgeData.fromAmount, preCapEPs);
				this.applyReforgeStat(coefficients, reforgeData.toStat, reforgeData.toAmount, preCapEPs);
				variables.set(variableKey, coefficients);
			}

			if (!this.includeGems) {
				continue;
			}
			const uiItem = item.item;
			const socketColors = item.curSocketColors(this.player.isBlacksmithing());
			if (!this.includeEOTBPGemSocket && (isShaTouchedWeapon(uiItem) || isThroneOfThunderWeapon(uiItem))) {
				socketColors.pop();
			}

			let socketBonusNormalization: number = socketColors.length || 1;

			if (socketBonusNormalization > 1 && socketColors[0] === GemColor.GemColorMeta) {
				socketBonusNormalization -= 1;
			}

			const distributedSocketBonus = new Stats(scaledItem.item.socketBonus).scale(1.0 / socketBonusNormalization).getBuffedStats();

			// First determine whether the socket bonus should be obviously matched in order to save on brute force computation.
			let forceSocketBonus: boolean = false;
			const socketBonusAsCoeff = new Map<string, number>();

			for (const [stat, value] of distributedSocketBonus.entries()) {
				this.applyReforgeStat(socketBonusAsCoeff, stat, value, preCapEPs);
			}

			if (ReforgeOptimizer.includesCappedStat(socketBonusAsCoeff, reforgeCaps, reforgeSoftCaps) && socketBonusNormalization > 1) {
				forceSocketBonus = true;
			}

			const dummyVariables = new Map<string, YalpsCoefficients>();
			dummyVariables.set('matched', new Map<string, number>());
			dummyVariables.set('unmatched', new Map<string, number>());

			for (const socketColor of socketColors.values()) {
				if (![GemColor.GemColorRed, GemColor.GemColorBlue, GemColor.GemColorYellow, GemColor.GemColorPrismatic].includes(socketColor)) {
					break;
				}

				const matchedCoeffs = dummyVariables.get('matched')!;
				const worstMatchedGemData = gemsToInclude.get(socketColor)!.at(-1)!;

				for (const [key, value] of worstMatchedGemData.coefficients.entries()) {
					matchedCoeffs.set(key, (matchedCoeffs.get(key) || 0) + value);
				}

				for (const [key, value] of socketBonusAsCoeff.entries()) {
					matchedCoeffs.set(key, (matchedCoeffs.get(key) || 0) + value);
				}

				const unmatchedCoeffs = dummyVariables.get('unmatched')!;
				const worstUnmatchedGemData = gemsToInclude.get(GemColor.GemColorPrismatic)!.at(-1)!;

				for (const [key, value] of worstUnmatchedGemData.coefficients.entries()) {
					unmatchedCoeffs.set(key, (unmatchedCoeffs.get(key) || 0) + value);
				}
			}

			const scoredDummyVariables = this.updateReforgeScores(dummyVariables, preCapEPs);

			if (
				scoredDummyVariables.get('matched')!.get('score')! > scoredDummyVariables.get('unmatched')!.get('score')! &&
				(socketBonusNormalization > 1 || !ReforgeOptimizer.includesCappedStat(scoredDummyVariables.get('matched')!, reforgeCaps, reforgeSoftCaps))
			) {
				forceSocketBonus = true;
			}

			socketColors.forEach((socketColor, socketIdx) => {
				let gemColorKeys: GemColor[] = [];

				if ([GemColor.GemColorPrismatic, GemColor.GemColorCogwheel, GemColor.GemColorShaTouched].includes(socketColor)) {
					gemColorKeys.push(socketColor);
				} else if ([GemColor.GemColorRed, GemColor.GemColorBlue, GemColor.GemColorYellow].includes(socketColor)) {
					gemColorKeys.push(socketColor);

					if (!forceSocketBonus) {
						gemColorKeys.push(GemColor.GemColorPrismatic);
					}
				} else {
					return;
				}

				const constraintKey = `${slot}_${socketIdx}`;

				for (const gemColorKey of gemColorKeys) {
					for (const gemData of gemsToInclude.get(gemColorKey)!) {
						const variableKey = `${constraintKey}_${gemData.gem.id}`;
						const coefficients = new Map<string, number>(gemData.coefficients);
						coefficients.set(constraintKey, 1);

						if (gemMatchesSocket(gemData.gem, socketColor)) {
							for (const [stat, value] of distributedSocketBonus.entries()) {
								this.applyReforgeStat(coefficients, stat, value, preCapEPs);
							}
						}
						// Performance optimisation to force socket bonus matching for Jewelcrafting gems.
						else if (gemData.isJC) {
							continue;
						}

						if (gemColorKey == GemColor.GemColorCogwheel) {
							coefficients.set(`${gemData.gem.id}`, 1);
						}
						if (gemColorKey == GemColor.GemColorShaTouched) {
							coefficients.set('ShaTouchedGem', 1);
						}
						if (gemData.isJC) {
							coefficients.set('JewelcraftingGem', 1);
						}

						variables.set(variableKey, coefficients);
					}
				}
			});
		}

		return variables;
	}

	buildGemOptions(preCapEPs: Stats, reforgeCaps: Stats, reforgeSoftCaps: StatCap[]): Map<GemColor, GemData[]> {
		const gemsToInclude = new Map<GemColor, GemData[]>();

		if (!this.includeGems) {
			return gemsToInclude;
		}

		const hasJC = this.player.hasProfession(Profession.Jewelcrafting);
		const epStats = this.simUI.individualConfig.epStats;

		for (const socketColor of [
			GemColor.GemColorPrismatic,
			GemColor.GemColorShaTouched,
			GemColor.GemColorCogwheel,
			GemColor.GemColorRed,
			GemColor.GemColorBlue,
			GemColor.GemColorYellow,
		]) {
			const allGemsOfColor = this.player.getGems(socketColor);
			const filteredGemDataForColor = new Array<GemData>();
			let weightsForSorting = preCapEPs;

			if (this.relativeStatCap) {
				weightsForSorting = weightsForSorting.withUnitStat(
					this.relativeStatCap.forcedHighestStat,
					weightsForSorting.getUnitStat(this.relativeStatCap.constrainedStats[0]),
				);
			}

			for (const gem of allGemsOfColor) {
				const isJC = gem.requiredProfession == Profession.Jewelcrafting;
				if (
					(isJC && !hasJC) ||
					// Force non-tank specs to use exclusively primary stat JC gems to speed up calculations.
					// May need to revisit this approximation at higher ilvls.
					(isJC && !this.isTankSpec && !gemMatchesStats(gem, [Stat.StatStrength, Stat.StatAgility, Stat.StatIntellect])) ||
					// Remove Hit gems for Hybrid casters as they can use Spirit as well and this speeds up calculations
					(this.isHybridCaster && !!gem.stats[Stat.StatHitRating]) ||
					gem.name.includes('Perfect') ||
					!gemMatchesSocket(gem, socketColor)
				) {
					continue;
				}

				let allStatsValid = true;
				const coefficients = new Map<string, number>();

				for (const [statIdx, statValue] of gem.stats.entries()) {
					if (statValue == 0) {
						continue;
					}

					if (!epStats.includes(statIdx) && statIdx != Stat.StatExpertiseRating) {
						allStatsValid = false;
						break;
					}

					this.applyReforgeStat(coefficients, statIdx, statValue, weightsForSorting);
				}

				if (!allStatsValid) {
					continue;
				}

				// Create single-entry map to re-use scoring code.
				const gemVariableMap = new Map<string, YalpsCoefficients>([['temp', coefficients]]);
				const scoredGemVariableMap = this.updateReforgeScores(gemVariableMap, weightsForSorting);
				filteredGemDataForColor.push({
					gem,
					isJC,
					coefficients: scoredGemVariableMap.get('temp')!,
				});
			}

			// Sort from highest to lowest pre-cap EP.
			filteredGemDataForColor.sort((a, b) => b.coefficients.get('score')! - a.coefficients.get('score')!);

			// Go down the list and include all gems until we find the highest EP option with zero capped stats.
			let maxGemOptionsForStat: number = this.isTankSpec ? 3 : 4;

			if (socketColor == GemColor.GemColorYellow && !this.relativeStatCap) {
				let foundCritOrHasteCap = false;

				for (const parentStat of [Stat.StatCritRating, Stat.StatHasteRating]) {
					for (const childStat of UnitStat.getChildren(parentStat)) {
						if (pseudoStatIsCapped(childStat, reforgeCaps, reforgeSoftCaps)) {
							foundCritOrHasteCap = true;
						}
					}
				}

				if (!foundCritOrHasteCap) {
					maxGemOptionsForStat = 1;
				}
			}

			const includedGemDataForColor = new Array<GemData>();
			let foundUncappedJCGem = false;
			let foundUncappedNormalGem = false;
			let numUncappedNormalGems = 0;
			const numGemOptionsForStat = new Map<string, number>();

			for (const gemData of filteredGemDataForColor) {
				const cappedStatKeys = ReforgeOptimizer.getCappedStatKeys(gemData.coefficients, reforgeCaps, reforgeSoftCaps);
				let isRedundantGem: boolean = false;

				for (const statKey of cappedStatKeys) {
					const numExistingOptions = numGemOptionsForStat.get(statKey) || 0;

					if (numExistingOptions == maxGemOptionsForStat) {
						isRedundantGem = true;
					} else if (!gemData.isJC) {
						numGemOptionsForStat.set(statKey, numExistingOptions + 1);
					}
				}

				if ((!gemData.isJC || !foundUncappedJCGem) && !isRedundantGem && (cappedStatKeys.length == 0 || !foundUncappedNormalGem)) {
					includedGemDataForColor.push(gemData);
				}

				if (cappedStatKeys.length == 0 && socketColor != GemColor.GemColorCogwheel) {
					if (gemData.isJC) {
						foundUncappedJCGem = true;
					} else {
						foundUncappedNormalGem = true;
						numUncappedNormalGems++;

						if (!this.relativeStatCap || numUncappedNormalGems == 3) {
							break;
						}
					}
				}
			}

			gemsToInclude.set(socketColor, includedGemDataForColor);
		}

		return gemsToInclude;
	}

	// Apply stat dependencies before setting optimization coefficients
	applyReforgeStat(coefficients: YalpsCoefficients, stat: Stat, amount: number, preCapEPs: Stats) {
		if (stat == Stat.StatSpirit && this.player.getRace() == Race.RaceHuman) {
			amount *= 1.03;
		}

		// Handle Spirit to Spell Hit conversion for hybrid casters separately from standard dependencies
		if ((stat == Stat.StatSpirit && this.isHybridCaster) || stat == Stat.StatExpertiseRating) {
			this.setPseudoStatCoefficient(coefficients, PseudoStat.PseudoStatSpellHitPercent, amount / Mechanics.SPELL_HIT_RATING_PER_HIT_PERCENT);
		}

		// If a highest Stat constraint is to be enforced, then update the
		// associated coefficient if applicable.
		this.relativeStatCap?.updateCoefficients(coefficients, stat, amount);

		// If the pre-cap EP for the root stat is non-zero, then apply
		// the root stat directly and don't look for any children.
		if (preCapEPs.getStat(stat) != 0) {
			this.setStatCoefficient(coefficients, stat, amount);
			return;
		}

		// Loop over all dependent PseudoStats
		for (const childStat of UnitStat.getChildren(stat)) {
			// Only add a dependency if the child has an EP value associated with it
			if (preCapEPs.getPseudoStat(childStat) != 0) {
				this.setPseudoStatCoefficient(coefficients, childStat, UnitStat.fromPseudoStat(childStat).convertRatingToPercent(amount)!);
			}
		}
	}

	setStatCoefficient(coefficients: YalpsCoefficients, stat: Stat, amount: number) {
		const currentValue = coefficients.get(Stat[stat]) || 0;
		coefficients.set(Stat[stat], currentValue + amount);
	}

	setPseudoStatCoefficient(coefficients: YalpsCoefficients, pseudoStat: PseudoStat, amount: number) {
		const currentValue = coefficients.get(PseudoStat[pseudoStat]) || 0;
		coefficients.set(PseudoStat[pseudoStat], currentValue + amount);
	}

	buildYalpsConstraints(gear: Gear, baseStats: Stats): YalpsConstraints {
		const constraints = new Map<string, Constraint>();
		const allCogwheelGems = this.includeGems ? this.player.getGems(GemColor.GemColorCogwheel) : [];

		for (const slot of gear.getItemSlots()) {
			constraints.set(ItemSlot[slot], lessEq(1));

			if (this.includeGems) {
				gear.getEquippedItem(slot)
					?.curSocketColors(this.player.isBlacksmithing())
					.forEach((_, socketIdx) => {
						constraints.set(`${slot}_${socketIdx}`, lessEq(1));
					});

				// Enforce uniqueness of Sha-Touched gems.
				constraints.set('ShaTouchedGem', lessEq(1));

				// Enforce two Jewelcrafting gems.
				constraints.set('JewelcraftingGem', lessEq(2));

				// Enforce uniqueness of Cogwheel gems.
				for (const cogwheelGem of allCogwheelGems) {
					if (!cogwheelGem.unique) continue;
					constraints.set(`${cogwheelGem.id}`, lessEq(1));
				}
			}
		}

		if (this.relativeStatCap) {
			this.relativeStatCap.updateConstraints(constraints, gear, baseStats);
		}

		return constraints;
	}

	async solveModel(
		gear: Gear,
		weights: Stats,
		reforgeCaps: Stats,
		reforgeSoftCaps: StatCap[],
		variables: YalpsVariables,
		constraints: YalpsConstraints,
		maxIterations: number,
		maxSeconds: number,
	): Promise<number> {
		// Calculate EP scores for each Reforge option
		if (isDevMode()) {
			console.log('Stat weights for this iteration:');
			console.log(weights);
		}
		const updatedVariables = this.updateReforgeScores(variables, weights);
		if (isDevMode()) {
			console.log('Optimization variables and constraints for this iteration:');
			console.log(updatedVariables);
			console.log(constraints);
		}

		// Set up and solve YALPS model
		const model: Model = {
			direction: 'maximize',
			objective: 'score',
			constraints: constraints,
			variables: updatedVariables,
			binaries: true,
		};
		const options: Options = {
			timeout: maxSeconds * 1000,
			maxIterations: maxIterations,
			tolerance: 0.01,
		};
		const startTimeMs: number = Date.now();
		const solution = solve(model, options);
		const elapsedSeconds: number = (Date.now() - startTimeMs) / 1000;

		if (isDevMode()) {
			console.log('LP solution for this iteration:');
			console.log(solution);
		}

		if (isNaN(solution.result) || (solution.status == 'timedout' && maxIterations < 4000000 && elapsedSeconds < maxSeconds)) {
			if (maxIterations > 4000000 || elapsedSeconds > maxSeconds) {
				if (solution.status == 'infeasible') {
					throw 'The specified stat caps are impossible to achieve. Consider changing any upper bound stat caps to lower bounds instead.';
				} else if (solution.status == 'timedout' && this.includeTimeout) {
					throw 'Solver timed out before finding a feasible solution. Consider un-checking "Limit execution time" in the Reforge settings.';
				} else {
					throw solution.status;
				}
			} else {
				if (isDevMode()) console.log('No optimal solution was found, doubling max iterations...');
				return await this.solveModel(
					gear,
					weights,
					reforgeCaps,
					reforgeSoftCaps,
					variables,
					constraints,
					maxIterations * 10,
					maxSeconds - elapsedSeconds,
				);
			}
		}

		// Apply the current solution
		const updatedGear = await this.applyLPSolution(gear, solution);

		// Check if any unconstrained stats exceeded their specified cap.
		// If so, add these stats to the constraint list and re-run the solver.
		// If no unconstrained caps were exceeded, then we're done.
		const [anyCapsExceeded, updatedConstraints, updatedWeights] = this.checkCaps(
			solution,
			reforgeCaps,
			reforgeSoftCaps,
			updatedVariables,
			constraints,
			weights,
		);

		if (!anyCapsExceeded) {
			if (isDevMode()) console.log('Reforge optimization has finished!');
			return solution.result;
		} else {
			if (isDevMode()) console.log('One or more stat caps were exceeded, starting constrained iteration...');
			await sleep(100);
			return await this.solveModel(
				updatedGear,
				updatedWeights,
				reforgeCaps,
				reforgeSoftCaps,
				updatedVariables,
				updatedConstraints,
				maxIterations,
				maxSeconds - elapsedSeconds,
			);
		}
	}

	updateReforgeScores(variables: YalpsVariables, weights: Stats): YalpsVariables {
		const updatedVariables = new Map<string, YalpsCoefficients>();

		for (const [variableKey, coefficients] of variables.entries()) {
			let score = 0;
			const updatedCoefficients = new Map<string, number>();

			for (const [coefficientKey, value] of coefficients.entries()) {
				updatedCoefficients.set(coefficientKey, value);

				// Determine whether the key corresponds to a stat change. If so, apply
				// current EP for that stat. It is assumed that the supplied weights have
				// already been updated to post-cap values for any stats that were
				// constrained to be capped in a previous iteration.
				if (coefficientKey.includes('PseudoStat')) {
					const statKey = (PseudoStat as any)[coefficientKey] as PseudoStat;
					score += weights.getPseudoStat(statKey) * value;
				} else if (coefficientKey.includes('Stat')) {
					const statKey = (Stat as any)[coefficientKey] as Stat;
					score += weights.getStat(statKey) * value;
				}
			}

			updatedCoefficients.set('score', score);
			updatedVariables.set(variableKey, updatedCoefficients);
		}

		return updatedVariables;
	}

	async applyLPSolution(gear: Gear, solution: Solution): Promise<Gear> {
		let updatedGear = gear.withoutReforges(this.player.canDualWield2H(), this.frozenItemSlots);

		if (this.includeGems) {
			updatedGear = updatedGear.withoutGems(this.player.canDualWield2H(), this.frozenItemSlots, true);
		}

		for (const [variableKey, _coefficient] of solution.variables) {
			const splitKey = variableKey.split('_');
			const slot = parseInt(splitKey[0]) as ItemSlot;
			const equippedItem = updatedGear.getEquippedItem(slot);

			if (equippedItem) {
				if (splitKey.length > 2) {
					const socketIdx = parseInt(splitKey[1]);
					const gemId = parseInt(splitKey[2]);
					updatedGear = updatedGear.withGem(slot, socketIdx, this.sim.db.lookupGem(gemId));
					continue;
				}

				const reforgeId = parseInt(splitKey[1]);
				updatedGear = updatedGear.withEquippedItem(
					slot,
					equippedItem.withReforge(this.sim.db.getReforgeById(reforgeId)!),
					this.player.canDualWield2H(),
				);
			}
		}

		if (this.includeGems) {
			updatedGear = this.minimizeRegems(updatedGear);
		}

		await this.updateGear(updatedGear);
		return updatedGear;
	}

	checkCaps(
		solution: Solution,
		reforgeCaps: Stats,
		reforgeSoftCaps: StatCap[],
		variables: YalpsVariables,
		constraints: YalpsConstraints,
		currentWeights: Stats,
	): [boolean, YalpsConstraints, Stats] {
		// First add up the total stat changes from the solution
		let reforgeStatContribution = new Stats();

		for (const [variableKey, _coefficient] of solution.variables) {
			for (const [coefficientKey, value] of variables.get(variableKey)!.entries()) {
				if (coefficientKey.includes('PseudoStat')) {
					const statKey = (PseudoStat as any)[coefficientKey] as PseudoStat;
					reforgeStatContribution = reforgeStatContribution.addPseudoStat(statKey, value);
				} else if (coefficientKey.includes('Stat')) {
					const statKey = (Stat as any)[coefficientKey] as Stat;
					reforgeStatContribution = reforgeStatContribution.addStat(statKey, value);
				}
			}
		}

		if (isDevMode()) {
			console.log('Total stat contribution from Reforging:');
			console.log(reforgeStatContribution);
		}

		// Then check whether any unconstrained stats exceed their cap
		let anyCapsExceeded = false;
		const updatedConstraints = new Map<string, Constraint>(constraints);
		let updatedWeights = currentWeights;

		for (const [unitStat, value] of reforgeStatContribution.asUnitStatArray()) {
			const cap = reforgeCaps.getUnitStat(unitStat);
			const statName = unitStat.getKey();

			if (cap !== 0 && value > cap && !constraints.has(statName)) {
				anyCapsExceeded = true;
				if (isDevMode()) console.log('Cap exceeded for: %s', statName);

				// Set EP to 0 for hard capped stats unless they are treated as upper bounds.
				if (this.undershootCaps.getUnitStat(unitStat)) {
					updatedConstraints.set(statName, lessEq(cap));
				} else {
					updatedConstraints.set(statName, greaterEq(cap));
					updatedWeights = updatedWeights.withUnitStat(unitStat, 0);
				}
			}
		}

		// If hard caps are all taken care of, then deal with any remaining soft cap breakpoints
		while (!anyCapsExceeded && reforgeSoftCaps.length > 0) {
			const nextSoftCap = reforgeSoftCaps[0];
			const unitStat = nextSoftCap.unitStat;
			const statName = unitStat.getKey();
			const currentValue = reforgeStatContribution.getUnitStat(unitStat);

			let idx = 0;
			for (const breakpoint of nextSoftCap.breakpoints) {
				if (currentValue > breakpoint) {
					updatedConstraints.set(statName, greaterEq(breakpoint));
					updatedWeights = updatedWeights.withUnitStat(unitStat, nextSoftCap.postCapEPs[idx]);
					anyCapsExceeded = true;
					if (isDevMode()) console.log('Breakpoint exceeded for: %s', statName);
					break;
				}

				idx++;
			}

			// For true soft cap stats (evaluated in ascending order), remove any breakpoint that was
			// exceeded from the configuration. If no breakpoints were exceeded or there are none
			// remaining, then remove the entry completely from reforgeSoftCaps. In contrast, for threshold
			// stats (evaluated in descending order), always remove the entry completely after the first
			// pass.
			if (nextSoftCap.capType == StatCapType.TypeSoftCap) {
				nextSoftCap.breakpoints = nextSoftCap.breakpoints.slice(idx + 1);
				nextSoftCap.postCapEPs = nextSoftCap.postCapEPs.slice(idx + 1);
			}

			if (nextSoftCap.capType == StatCapType.TypeThreshold || nextSoftCap.breakpoints.length == 0) {
				reforgeSoftCaps.shift();
			}
		}

		return [anyCapsExceeded, updatedConstraints, updatedWeights];
	}

	minimizeRegems(newGear: Gear): Gear {
		const originalGear = this.previousGear;

		if (!originalGear) {
			return newGear;
		}

		const isBlacksmithing = this.player.isBlacksmithing();
		const finalizedSocketKeys: string[] = [];

		for (const slot of newGear.getItemSlots()) {
			const newItem = newGear.getEquippedItem(slot);
			const originalItem = originalGear.getEquippedItem(slot);

			if (!newItem || !originalItem) {
				continue;
			}

			const newGems = newItem.curGems(isBlacksmithing);
			const originalGems = originalItem.curGems(isBlacksmithing);

			for (const [socketIdx, socketColor] of newItem.curSocketColors(isBlacksmithing).entries()) {
				const socketKey = `${slot}_${socketIdx}`;

				if (finalizedSocketKeys.includes(socketKey)) {
					continue;
				}

				finalizedSocketKeys.push(socketKey);

				if (!newGems[socketIdx] || !originalGems[socketIdx] || newGems[socketIdx]!.id === originalGems[socketIdx]!.id) {
					continue;
				}

				if (gemMatchesSocket(newGems[socketIdx]!, socketColor) && !gemMatchesSocket(originalGems[socketIdx]!, socketColor)) {
					continue;
				}

				for (const [matchedSlot, matchedSocketIdx] of newGear.findGem(originalGems[socketIdx]!, isBlacksmithing)) {
					if (this.frozenItemSlots.has(matchedSlot)) {
						continue;
					}

					const matchedSocketKey = `${matchedSlot}_${matchedSocketIdx}`;

					if (finalizedSocketKeys.includes(matchedSocketKey)) {
						continue;
					}

					const matchedSocketColor = newGear.getEquippedItem(matchedSlot)!.curSocketColors(isBlacksmithing)[matchedSocketIdx];

					if (gemMatchesSocket(originalGems[socketIdx]!, matchedSocketColor) && !gemMatchesSocket(newGems[socketIdx]!, matchedSocketColor)) {
						continue;
					}

					finalizedSocketKeys.push(matchedSocketKey);
					newGear = newGear.withGem(slot, socketIdx, originalGems[socketIdx]);
					newGear = newGear.withGem(matchedSlot, matchedSocketIdx, newGems[socketIdx]);
					break;
				}
			}
		}

		return newGear;
	}

	private get baseMastery() {
		return this.player.getBaseMastery() * Mechanics.MASTERY_RATING_PER_MASTERY_POINT;
	}

	private toVisualTotalMasteryPercentage(statPoints: number, statValue: number) {
		// If the value is less than or equal to the base mastery, then set it to 0,
		// because we assume you want to reset this stat cap.
		if (statValue - this.baseMastery <= 0) {
			statPoints = 0;
		} else {
			// When displaying the mastery percentage we want to include the base mastery
			statPoints *= this.player.getMasteryPerPointModifier();
		}
		return statPoints;
	}

	private toVisualUnitStatPercentage(statValue: number, unitStat: UnitStat) {
		const rawStatValue = statValue;
		let percentOrPointsValue = unitStat.convertDefaultUnitsToPercent(rawStatValue)!;
		if (unitStat.equalsStat(Stat.StatMasteryRating)) percentOrPointsValue = this.toVisualTotalMasteryPercentage(percentOrPointsValue, rawStatValue);

		return percentOrPointsValue;
	}

	private toDefaultUnitStatValue(value: number, unitStat: UnitStat) {
		let statValue = unitStat.convertPercentToDefaultUnits(value)!;
		if (unitStat.equalsStat(Stat.StatMasteryRating)) statValue /= this.player.getMasteryPerPointModifier();
		return statValue;
	}

	private breakpointValueToDisplayPercentage(value: number, unitStat: UnitStat) {
		return unitStat.equalsStat(Stat.StatMasteryRating)
			? ((value / Mechanics.MASTERY_RATING_PER_MASTERY_POINT) * this.player.getMasteryPerPointModifier()).toFixed(2)
			: unitStat.convertDefaultUnitsToPercent(value)!.toFixed(2);
	}

	onReforgeDone() {
		const itemSlots = this.player.getGear().getItemSlots();
		const changedSlots = new Map<ItemSlot, ReforgeData | undefined>();
		for (const slot of itemSlots) {
			const prev = this.previousReforges.get(slot);
			const current = this.currentReforges.get(slot);
			if (!ReforgeStat.equals(prev?.reforge, current?.reforge)) changedSlots.set(slot, current);
		}
		const hasReforgeChanges = changedSlots.size;

		const copyButtonContainerRef = ref<HTMLDivElement>();
		const changedReforgeMessage = (
			<>
				<p className="mb-0">{i18n.t('gear_tab.reforge_success.title')}</p>
				<ul>
					{[...changedSlots].map(([slot, reforge]) => {
						if (reforge) {
							const slotName = translateSlotName(slot);
							const { fromStat, toStat } = reforge;
							const fromText = translateStat(fromStat);
							const toText = translateStat(toStat);
							return (
								<li>
									{slotName}: {fromText} → {toText}
								</li>
							);
						} else {
							return (
								<li>
									{translateSlotName(slot)}: {i18n.t('gear_tab.reforge_success.removed_reforge')}
								</li>
							);
						}
					})}
				</ul>
				<div ref={copyButtonContainerRef} />
			</>
		);

		if (hasReforgeChanges) {
			const settingsExport = IndividualSimSettings.toJson(this.simUI.toProto());
			if (settingsExport)
				new CopyButton(copyButtonContainerRef.value!, {
					extraCssClasses: ['btn-outline-primary'],
					getContent: () => JSON.stringify(settingsExport),
					text: i18n.t('gear_tab.reforge_success.copy_to_reforge_lite'),
				});
		}

		trackEvent({
			action: 'settings',
			category: 'reforging',
			label: 'suggest_success',
		});
		new Toast({
			variant: 'success',
			body: hasReforgeChanges ? changedReforgeMessage : <>{i18n.t('gear_tab.reforge_success.no_changes')}</>,
			delay: hasReforgeChanges ? 5000 : 3000,
		});
	}

	onReforgeError(error: any) {
		if (isDevMode()) console.log(error);

		if (this.previousGear) this.updateGear(this.previousGear);
		trackEvent({
			action: 'settings',
			category: 'reforging',
			label: 'suggest_error',
			value: error,
		});
		new Toast({
			variant: 'error',
			body: (
				<>
					{i18n.t('sidebar.buttons.suggest_reforges.reforge_optimization_failed')}
					<p></p>
					<p>
						<b>Reason for failure:</b> <i>{error}</i>
					</p>
				</>
			),
			delay: 10000,
		});
	}

	fromProto(eventID: EventID, proto: ReforgeSettings) {
		TypedEvent.freezeAllAndDo(() => {
			this.setUseCustomEPValues(eventID, proto.useCustomEpValues);
			this.setStatCaps(eventID, Stats.fromProto(proto.statCaps));
			this.setUseSoftCapBreakpoints(eventID, proto.useSoftCapBreakpoints);
			this.setIncludeTimeout(eventID, proto.includeTimeout);
			this.setIncludeGems(eventID, proto.includeGems);
			this.setIncludeEOTBPGemSocket(eventID, proto.includeEotbGemSocket);
			this.setFreezeItemSlots(eventID, proto.freezeItemSlots);
			this.setFrozenItemSlots(eventID, proto.frozenItemSlots);
			this.setBreakpointLimits(eventID, Stats.fromProto(proto.breakpointLimits));
			if (proto.relativeStatCapStat) {
				this.setRelativeStatCap(eventID, UnitStat.fromProto(proto.relativeStatCapStat).getStat());
			}
		});
	}
	toProto(): ReforgeSettings {
		return ReforgeSettings.create({
			useCustomEpValues: this.useCustomEPValues,
			useSoftCapBreakpoints: this.useSoftCapBreakpoints,
			includeTimeout: this.includeTimeout,
			includeGems: this.includeGems,
			includeEotbGemSocket: this.includeEOTBPGemSocket,
			freezeItemSlots: this.freezeItemSlots,
			frozenItemSlots: [...this.frozenItemSlots],
			breakpointLimits: this.breakpointLimits.toProto(),
			relativeStatCapStat: this.relativeStatCap?.forcedHighestStat.toProto(),
			statCaps: this.statCaps.toProto(),
		});
	}
	applyDefaults(eventID: EventID) {
		TypedEvent.freezeAllAndDo(() => {
			this.setUseCustomEPValues(eventID, false);
			this.setUseSoftCapBreakpoints(eventID, !!this.simUI.individualConfig.defaults.softCapBreakpoints?.length);
			this.setIncludeTimeout(eventID, true);
			this.setIncludeGems(eventID, false);
			this.setIncludeEOTBPGemSocket(eventID, false);
			this.setFreezeItemSlots(eventID, false);
			this.setStatCaps(eventID, this.simUI.individualConfig.defaults.statCaps || new Stats());
			this.setBreakpointLimits(eventID, this.simUI.individualConfig.defaults.breakpointLimits || new Stats());
			this.setSoftCapBreakpoints(eventID, this.simUI.individualConfig.defaults.softCapBreakpoints || []);
			this.setRelativeStatCap(eventID, this.relativeStatCapStat);
		});
	}
}
