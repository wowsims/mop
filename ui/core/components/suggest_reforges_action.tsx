import clsx from 'clsx';
import tippy, { hideAll } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import i18n from '../../i18n/config.js';
import * as Mechanics from '../constants/mechanics.js';
import { SimSettingCategories } from '../constants/sim_settings';
import { IndividualSimUI } from '../individual_sim_ui';
import { Player } from '../player';
import { Player as PlayerProtoMessageType, ReforgeOptimizeMode, ReforgeOptimizeRequest, ReforgeSettings, StatCapType } from '../proto/api';
import { Class, Debuffs, GemColor, ItemQuality, ItemSlot, PartyBuffs, Profession, PseudoStat, RaidBuffs, Spec, Stat } from '../proto/common';
import { UIGem as Gem, IndividualSimSettings } from '../proto/ui';
import { Database } from '../proto_utils/database';
import { EquippedItem } from '../proto_utils/equipped_item';
import { Gear } from '../proto_utils/gear';
import { getEmptyGemSocketIconUrl } from '../proto_utils/gems';
import { statCapTypeNames } from '../proto_utils/names';
import { getReforgeCacheGearKey } from '../proto_utils/utils';
import { translateSlotName, translateStat } from '../../i18n/localization';
import { StatCap, Stats, UnitStat, UnitStatPresets } from '../proto_utils/stats';
import type { ReforgeOptimizeConfig, Sim } from '../sim';
import { ActionGroupItem } from '../sim_ui';
import { EventID, TypedEvent } from '../typed_event';
import { distinct, isDevMode } from '../utils';
import { CopyButton } from './copy_button';
import { BooleanPicker } from './pickers/boolean_picker';
import { EnumPicker } from './pickers/enum_picker';
import { NumberPicker, NumberPickerConfig } from './pickers/number_picker';
import { renderSavedEPWeights } from './saved_data_managers/ep_weights';
import Toast from './toast';
import { trackEvent, trackPageView } from '../../tracking/utils';
import { RequestTypes } from '../sim_signal_manager';
import { ReforgeGearCache } from '../reforge_cache';
import { ProgressTrackerModal } from './progress_tracker_modal';
import { getEmptySlotIconUrl } from './gear_picker/utils';

type GemData = {
	gem: Gem;
	isJC: boolean;
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
	statTooltips?: StatTooltipContent;
	statSelectionPresets?: UnitStatPresets[];
	// Allows you to enable breakpoint limits for Treshold type caps
	enableBreakpointLimits?: boolean;
	// Allows you to get alternate default EPs
	// For example for Fury where you have SMF and TG EPs
	getEPDefaults?: (player: Player<any>) => Stats;
	// Allows you to modify default softCaps
	// For example you wish to add breakpoints for Berserking / Bloodlust if enabled
	updateSoftCaps?: (softCaps: StatCap[], player: Player<any>) => StatCap[];
	// Allows you to specifiy additional information for the soft cap tooltips
	additionalSoftCapTooltipInformation?: StatTooltipContent;
	// Sets the default stat to be the highest for relative stat cap calculations
	// Defaults to Any
	defaultRelativeStatCap?: Stat | null;
};

// Used to force a particular proc from trinkets like Matrix Restabilizer and Apparatus of Khaz'goroth.
export class RelativeStatCap {
	static relevantStats: Stat[] = [Stat.StatCritRating, Stat.StatHasteRating, Stat.StatMasteryRating];
	readonly forcedHighestStat: UnitStat;

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

	constructor(forcedHighestStat: Stat) {
		if (!RelativeStatCap.relevantStats.includes(forcedHighestStat)) {
			throw new Error('Forced highest stat must be either Crit, Haste, or Mastery!');
		}
		this.forcedHighestStat = UnitStat.fromStat(forcedHighestStat);
	}
}

export class ReforgeOptimizer {
	protected readonly simUI: IndividualSimUI<any>;
	protected readonly player: Player<any>;
	protected readonly playerClass: Class;
	protected readonly isHybridCaster: boolean;
	protected readonly isTankSpec: boolean;
	protected readonly sim: Sim;
	protected readonly defaults: IndividualSimUI<any>['individualConfig']['defaults'];
	protected reforgeDoneToast: Toast | null = null;
	protected getEPDefaults: ReforgeOptimizerOptions['getEPDefaults'];
	protected _statCaps: Stats = new Stats();
	protected breakpointLimits: Stats = new Stats();
	protected _softCapsConfig: StatCap[];
	private useCustomEPValues = false;
	private useSoftCapBreakpoints = true;
	protected progressTrackerModal: ProgressTrackerModal;
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
	protected undershootCaps = new Stats();
	protected wasCM: boolean = false;
	protected isCancelling: boolean = false;
	protected previousGear: Gear | null = null;
	relativeStatCapStat: number = -1;
	relativeStatCap: RelativeStatCap | null = null;
	relativeStatCapPrecision: number = 0.0001;

	readonly includeGemsChangeEmitter = new TypedEvent<void>('IncludeGems');
	readonly includeEOTBPGemSocketChangeEmitter = new TypedEvent<void>('IncludeEOTBPGemSocket');
	readonly statCapsChangeEmitter = new TypedEvent<void>('StatCaps');
	readonly useCustomEPValuesChangeEmitter = new TypedEvent<void>('UseCustomEPValues');
	readonly useSoftCapBreakpointsChangeEmitter = new TypedEvent<void>('UseSoftCapBreakpoints');
	readonly softCapBreakpointsChangeEmitter = new TypedEvent<void>('SoftCapBreakpoints');
	readonly breakpointLimitsChangeEmitter = new TypedEvent<void>('BreakpointLimits');
	readonly freezeItemSlotsChangeEmitter = new TypedEvent<void>('FreezeItemSlots');
	readonly undershootCapsChangeEmitter = new TypedEvent<void>('UndershootCaps');
	readonly relativeStatCapStatChangeEmitter = new TypedEvent<void>('RelativeStatCapStat');
	readonly relativeStatCapPrecisionChangeEmitter = new TypedEvent<void>('RelativeStatCapPrecision');

	// Emits when any of the above emitters emit.
	readonly changeEmitter: TypedEvent<void>;

	constructor(simUI: IndividualSimUI<any>, options?: ReforgeOptimizerOptions) {
		this.simUI = simUI;
		this.player = simUI.player;
		this.playerClass = this.player.getClass();
		this.isHybridCaster = [Spec.SpecBalanceDruid, Spec.SpecShadowPriest, Spec.SpecElementalShaman, Spec.SpecMistweaverMonk].includes(this.player.getSpec());
		this.isTankSpec = this.player.getPlayerSpec().isTankSpec;
		this.sim = simUI.sim;
		this.defaults = simUI.individualConfig.defaults;
		this.getEPDefaults = options?.getEPDefaults;
		this.updateSoftCaps = options?.updateSoftCaps;
		this._softCapsConfig = this.defaults.softCapBreakpoints || [];
		this.statTooltips = { ...STAT_TOOLTIPS, ...options?.statTooltips };
		this.additionalSoftCapTooltipInformation = { ...options?.additionalSoftCapTooltipInformation };
		this.statSelectionPresets = options?.statSelectionPresets;
		this._statCaps = this.defaults.statCaps || new Stats();
		this.enableBreakpointLimits = !!options?.enableBreakpointLimits;
		this.relativeStatCapStat = options?.defaultRelativeStatCap ?? -1;
		this.progressTrackerModal = new ProgressTrackerModal(simUI.rootElem, {
			id: 'reforge-optimizer-progress-tracker',
			title: 'Optimizing Reforges',
			warning: (
				<>
					<p>
						Reforging can be a lengthy process, especially as specific stat caps and breakpoints come into play for classes. This may take a while,
						but be assured that the calculation will eventually complete.
					</p>
					<p className="mb-0">You may cancel this operation at any time using the button below.</p>
				</>
			),
			onCancel: async () => {
				this.isCancelling = true;
				if (isDevMode()) {
					console.log('User cancelled reforge optimization');
				}
				try {
					await this.abortReforgeOptimization();
				} catch {}
				if (this.previousGear) this.player.setGear(TypedEvent.nextEventID(), this.previousGear);
				this.progressTrackerModal.hide();
				trackEvent({
					action: 'settings',
					category: 'reforging',
					label: 'suggest_cancel',
				});

				new Toast({
					variant: 'warning',
					body: i18n.t('sidebar.buttons.suggest_reforges.reforge_optimization_cancelled'),
					delay: 3000,
				});
			},
		});

		const startReforgeOptimizationEntry: ActionGroupItem = {
			label: i18n.t('sidebar.buttons.suggest_reforges.title'),
			cssClass: 'suggest-reforges-action-button flex-grow-1',
			onClick: async () => {
				this.reforgeDoneToast?.hide();
				this.reforgeDoneToast = null;

				this.progressTrackerModal.show();
				trackEvent({
					action: 'settings',
					category: 'reforging',
					label: 'suggest_start',
				});

				this.wasCM = simUI.player.getChallengeModeEnabled();
				try {
					performance.mark('reforge-optimization-start');
					if (this.wasCM) {
						simUI.player.setChallengeModeEnabled(TypedEvent.nextEventID(), false);
					}
					const gear = await this.optimizeReforges();
					await this.player.setGearAsync(TypedEvent.nextEventID(), gear);
					this.onReforgeDone();
				} catch (error) {
					if (this.isCancelling) return;
					this.onReforgeError(error);
				} finally {
					this.onReforgeFinally();
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
			children: [startReforgeOptimizationButton, contextMenuButton],
		} = simUI.addActionGroup([startReforgeOptimizationEntry, contextMenuEntry], {
			cssClass: 'suggest-reforges-settings-group',
		});

		if (this.softCapsConfig)
			tippy(startReforgeOptimizationButton, {
				theme: 'suggest-reforges-softcaps',
				placement: 'bottom',
				maxWidth: 310,
				interactive: true,
				onShow: instance => {
					const softCaps = this.softCapsConfigWithLimits;
					if (!softCaps?.length) return false;
					instance.setContent(this.buildReforgeButtonTooltip(softCaps!));
				},
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
				this.statCapsChangeEmitter,
				this.useCustomEPValuesChangeEmitter,
				this.useSoftCapBreakpointsChangeEmitter,
				this.softCapBreakpointsChangeEmitter,
				this.breakpointLimitsChangeEmitter,
				this.freezeItemSlotsChangeEmitter,
				this.undershootCapsChangeEmitter,
				this.relativeStatCapStatChangeEmitter,
				this.relativeStatCapPrecisionChangeEmitter,
			],
			'ReforgeSettingsChange',
		);

		TypedEvent.onAny([this.useCustomEPValuesChangeEmitter, this.player.epWeightsChangeEmitter, this.statCapsChangeEmitter]).on(eventID => {
			if (this.useCustomEPValues && (this.player.hasCustomEPWeights() || !this._statCaps.equals(this.defaults.statCaps || new Stats()))) {
				this.setUseSoftCapBreakpoints(eventID, false);
			}
		});

		this.player.gearChangeEmitter.on(eventID => {
			this.setRelativeStatCap(eventID, this.relativeStatCapStat);
		});
	}

	get softCapsConfig() {
		return this.updateSoftCaps?.(StatCap.cloneSoftCaps(this._softCapsConfig), this.player) || this._softCapsConfig;
	}

	get softCapsConfigWithLimits() {
		if (!this.enableBreakpointLimits || !this.useSoftCapBreakpoints) return this.softCapsConfig;

		const softCaps = StatCap.cloneSoftCaps(this.softCapsConfig);
		for (const [unitStat, limit] of this.breakpointLimits.asUnitStatArray()) {
			if (!limit) continue;
			// A stat can have multiple configs (e.g. a SoftCap and a Threshold for the same stat), so apply the
			// limit to whichever config actually owns that breakpoint rather than just the first matching stat.
			for (const config of softCaps) {
				if (!config.unitStat.equals(unitStat) || !config.breakpoints.some(breakpoint => breakpoint == limit)) continue;
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
			} else if (this.player.hasCustomEPWeights()) {
				weights = this.defaults.epWeights;
			}
		}

		// Replace Spirit EP for hybrid casters with a small value in order to break ties between Spirit and Hit Reforges
		if (this.isHybridCaster) {
			weights = weights.withStat(Stat.StatSpirit, 0.01);
		}

		return weights;
	}

	buildReforgeButtonTooltip(softCapsConfigWithLimits: StatCap[]) {
		return (
			<>
				<p>{i18n.t('sidebar.buttons.suggest_reforges.breakpoints_implemented')}</p>
				<table className="w-100">
					<tbody>
						{softCapsConfigWithLimits.map(({ unitStat, breakpoints, capType, postCapEPs }, index) => (
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
		if (this.relativeStatCapStat === -1 || !RelativeStatCap.hasRoRo(this.player)) {
			this.relativeStatCap = null;
		} else {
			this.relativeStatCap = new RelativeStatCap(this.relativeStatCapStat);
		}

		this.relativeStatCapStatChangeEmitter.emit(eventID);
	}
	setRelativeStatCapPrecision(eventID: EventID, newValue: number) {
		this.relativeStatCapPrecision = newValue;
		this.relativeStatCapPrecisionChangeEmitter.emit(eventID);
	}

	setIncludeGems(eventID: EventID, newValue: boolean) {
		if (this.includeGems !== newValue) {
			this.includeGems = newValue;

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
							this.relativeStatCap = new RelativeStatCap(this.relativeStatCapStat);
						}

						return canEnable;
					},
				});

				const relativeStatCapPrecisionInput = new EnumPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-relcap-precision',
					label: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision_tooltip'),
					defaultValue: this.relativeStatCapPrecision,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_precise'), value: 0.0001 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_balanced'), value: 0.0005 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_fast'), value: 0.005 },
					],
					changedEvent: () =>
						TypedEvent.onAny([this.relativeStatCapPrecisionChangeEmitter, this.relativeStatCapStatChangeEmitter, this.player.gearChangeEmitter]),
					getValue: () => this.relativeStatCapPrecision,
					setValue: (_eventID, _player, newValue) => {
						this.setRelativeStatCapPrecision(TypedEvent.nextEventID(), newValue);
					},
					showWhen: () => RelativeStatCap.hasRoRo(this.player) && this.relativeStatCapStat !== -1,
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
						{relativeStatCapPrecisionInput.rootElem}
						{this.buildSoftCapBreakpointsLimiter({ useSoftCapBreakpointsInput })}
						{includeGemsInput.rootElem}
						{includeEOTBPGemSocket.rootElem}
						{freezeItemSlotsInput.rootElem}
						{this.buildFrozenSlotsInputs()}
						{this.buildEPWeightsToggle()}
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
								this.setStatCaps(
									TypedEvent.nextEventID(),
									this.statCaps.withUnitStat(unitStat, this.toDefaultUnitStatValue(newValue, unitStat)),
								);
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

	buildEPWeightsToggle() {
		const epWeightsContainerRef = ref<HTMLDivElement>();
		const content = (
			<>
				<div ref={epWeightsContainerRef} />
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

		const render = () => {
			const container = epWeightsContainerRef.value;
			if (container) {
				const epPicker = renderSavedEPWeights(null, this.simUI, {
					extraCssClasses: ['mt-3'],
					loadOnly: true,
					presetsOnly: !this.useCustomEPValues,
				});
				container.replaceChildren(epPicker.rootElem);
			}
		};

		this.useCustomEPValuesChangeEmitter.on(() => render());
		render();

		return content;
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
								(config.capType === StatCapType.TypeThreshold || config.capType === StatCapType.TypeSoftCap) && config.breakpoints.length > 0,
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

	getReforgeOptimizeConfig(gear: Gear): ReforgeOptimizeConfig {
		const settings = this.toProto();
		settings.statCaps = this.processedStatCaps.toProto();

		return {
			gear,
			preCapEPWeights: this.preCapEPs,
			epStats: this.simUI.individualConfig.epStats,
			undershootCaps: this.undershootCaps,
			settings,
			softCaps: this.softCapsConfigWithLimits,
		};
	}

	static async getConfigHash({
		player,
		reforgeRequest,
		raidBuffs,
		partyBuffs,
		debuffs,
	}: {
		player: Player<any>;
		reforgeRequest: ReforgeOptimizeRequest;
		raidBuffs: RaidBuffs;
		partyBuffs: PartyBuffs | undefined;
		debuffs: Debuffs;
	}): Promise<string> {
		const playerProto = player.toProto(true, false, [
			SimSettingCategories.Talents,
			SimSettingCategories.Consumes,
			SimSettingCategories.External,
			SimSettingCategories.Miscellaneous,
		]);
		playerProto.bonusStats = player.getBonusStats().toProto();
		playerProto.enableItemSwap = player.itemSwapSettings.getEnableItemSwap();
		playerProto.itemSwap = player.itemSwapSettings.toProto();
		playerProto.equipment = undefined;
		playerProto.database = undefined;
		playerProto.channelClipDelayMs = 0;
		playerProto.inFrontOfTarget = false;
		playerProto.distanceFromTarget = 0;
		playerProto.healingModel = undefined;

		const reforgeOptimizerConfigForHash = ReforgeOptimizeRequest.clone(reforgeRequest);
		reforgeOptimizerConfigForHash.requestId = '';
		reforgeOptimizerConfigForHash.raid = undefined;
		reforgeOptimizerConfigForHash.debug = false;
		reforgeOptimizerConfigForHash.mode = ReforgeOptimizeMode.ReforgeOptimizeModeSingle;
		reforgeOptimizerConfigForHash.gemOptions = reforgeOptimizerConfigForHash.gemOptions.sort((a, b) => a.id - b.id);

		return ReforgeGearCache.getHash({
			player: PlayerProtoMessageType.toJsonString(playerProto),
			raid: {
				buffs: RaidBuffs.toJsonString(raidBuffs),
				partyBuffs: partyBuffs ? PartyBuffs.toJsonString(partyBuffs) : null,
				debuffs: Debuffs.toJsonString(debuffs),
			},
			optimizer: ReforgeOptimizeRequest.toJsonString(reforgeOptimizerConfigForHash),
		});
	}

	// Builds the ReforgeOptimizeRequest used as the config portion of the cache key.
	// Excludes raid and gear — those are separate components of the cache key.
	getReforgeRequestForHash(config: ReforgeOptimizeConfig): ReforgeOptimizeRequest {
		return ReforgeOptimizeRequest.create({
			...ReforgeOptimizer.makeReforgeConfigRequestFields(config, this.sim.db),
		});
	}

	async optimizeReforges(gear?: Gear) {
		if (isDevMode()) console.log('Starting Reforge optimization...');
		const previousGear = gear || this.player.getGear();
		this.previousGear = previousGear;

		const config = this.getReforgeOptimizeConfig(previousGear);
		const cache = ReforgeGearCache.get(this.player.getPlayerSpec());
		const configHash = await ReforgeOptimizer.getConfigHash({
			player: this.player,
			reforgeRequest: this.getReforgeRequestForHash(config),
			raidBuffs: this.sim.raid.getBuffs(),
			partyBuffs: this.player.getParty()?.getBuffs(),
			debuffs: this.sim.raid.getDebuffs(),
		});
		const frozenItemSlots = config.settings.freezeItemSlots && config.settings.frozenItemSlots.length ? config.settings.frozenItemSlots : undefined;
		// Existing gems must be part of the cache key whether or not includeGems is set: with it off
		// the optimizer keeps the equipped gems, and with it on minimizeRegems reuses them. Either
		// way the optimized gear depends on the equipped gems, so dropping them returns stale gear.
		const cacheKey = await ReforgeGearCache.getKey(getReforgeCacheGearKey(previousGear.asSpec(), frozenItemSlots), configHash);
		const cachedGear = await cache.get(cacheKey);
		if (cachedGear) {
			if (isDevMode()) console.log('Reforge optimization: cache hit.');
			return this.sim.db.lookupEquipmentSpec(cachedGear);
		}

		const result = await this.sim.reforgeOptimize(config);
		if (!result.optimizedGear) {
			throw new Error('Native Go reforge optimizer did not return optimized gear.');
		}

		await cache.setGear(cacheKey, result.optimizedGear);

		return this.sim.db.lookupEquipmentSpec(result.optimizedGear);
	}

	private toVisualUnitStatPercentage(statValue: number, unitStat: UnitStat) {
		const rawStatValue = statValue;
		let percentOrPointsValue = unitStat.convertDefaultUnitsToPercent(rawStatValue)!;
		if (unitStat.equalsStat(Stat.StatMasteryRating)) {
			const baseMastery = this.player.getBaseMastery() * Mechanics.MASTERY_RATING_PER_MASTERY_POINT;
			percentOrPointsValue = rawStatValue - baseMastery <= 0 ? 0 : percentOrPointsValue * this.player.getMasteryPerPointModifier();
		}

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

	static getReforgeGemOptions(db: Database, settings: ReforgeSettings): Gem[] {
		return settings.includeGems
			? distinct(
					[
						GemColor.GemColorPrismatic,
						GemColor.GemColorShaTouched,
						GemColor.GemColorCogwheel,
						GemColor.GemColorRed,
						GemColor.GemColorBlue,
						GemColor.GemColorYellow,
					]
						.flatMap(socketColor => db.getGems(socketColor))
						.filter(gem => !gem.name.includes('Perfect') && gem.quality >= ItemQuality.ItemQualityRare)
						.flat(),
					(a, b) => a.id == b.id,
				)
			: [];
	}

	static makeReforgeConfigRequestFields(config: ReforgeOptimizeConfig, db: Database) {
		return {
			preCapEpWeights: config.preCapEPWeights.toProto(),
			epStats: config.epStats.slice(),
			undershootCaps: config.undershootCaps.toProto(),
			settings: config.settings,
			softCaps: config.softCaps.map(softCap => ({
				unitStat: softCap.unitStat.toProto(),
				breakpoints: softCap.breakpoints.slice(),
				capType: softCap.capType,
				postCapEPs: softCap.postCapEPs.slice(),
			})),
			gemOptions: ReforgeOptimizer.getReforgeGemOptions(db, config.settings).map(gem => ({
				id: gem.id,
				name: gem.name,
				icon: gem.icon,
				color: gem.color,
				stats: gem.stats.slice(),
				phase: gem.phase,
				quality: gem.quality ?? ItemQuality.ItemQualityJunk,
				unique: gem.unique,
				requiredProfession: gem.requiredProfession ?? Profession.ProfessionUnknown,
				disabledInChallengeMode: gem.disabledInChallengeMode,
			})),
		};
	}

	onReforgeDone() {
		const currentGear = this.player.getGear();
		const itemSlots = currentGear.getItemSlots();
		const changedSlots = new Map<ItemSlot, EquippedItem | undefined>();
		for (const slot of itemSlots) {
			const prev = this.previousGear?.getEquippedItem(slot);
			const current = currentGear?.getEquippedItem(slot);

			if ((!prev && current) || (prev && current && !prev?.equals(current))) changedSlots.set(slot, current);
		}
		const hasReforgeChanges = changedSlots.size;

		const copyButtonContainerRef = ref<HTMLDivElement>();
		const changedReforgeMessage = (
			<>
				<p className="mb-0">{i18n.t('gear_tab.reforge_success.title')}</p>
				<ul className="suggest-reforges-gear-list list-reset">
					{itemSlots.map(slot => {
						const item = changedSlots.get(slot);
						const slotName = translateSlotName(slot);
						const iconRef = ref<HTMLDivElement>();
						const reforgeRef = ref<HTMLDivElement>();
						const socketsContainerRef = ref<HTMLDivElement>();
						const itemElement = (
							<div className="item-picker-root">
								<div
									ref={iconRef}
									className="item-picker-icon-wrapper"
									style={{
										backgroundImage: `url('${getEmptySlotIconUrl(slot)}')`,
									}}>
									<div ref={reforgeRef} className="suggest-reforges-gear-reforge interactive d-none"></div>
									<div ref={socketsContainerRef} className="item-picker-sockets-container"></div>
								</div>
							</div>
						);

						if (item) {
							item.asActionId()
								.fill(undefined)
								.then(filledId => {
									filledId.setBackground(iconRef.value!);
								});

							const previousItem = this.previousGear?.getEquippedItem(slot);
							const previousReforge = previousItem?.reforge;
							const previousGems = previousItem?.gems;

							const { reforge, gems } = item;

							if (reforge || previousReforge) {
								let message: Element;
								if (reforge) {
									const { fromStat, toStat } = reforge;
									const fromText = translateStat(fromStat);
									const toText = translateStat(toStat);
									message = (
										<>
											{fromText} → {toText}
										</>
									);
								} else {
									message = <>{i18n.t('gear_tab.reforge_success.removed_reforge')}</>;
								}

								reforgeRef.value?.classList.remove('d-none');
								tippy(reforgeRef.value!, {
									content: (
										<>
											<strong>{slotName}</strong>
											<br />
											{message}
										</>
									),
								});
							}

							if (gems || previousGems) {
								const changedGems: number[] = [];
								previousItem?.gemSockets.forEach((_, socketIdx) => {
									const previousGem = previousGems ? previousGems[socketIdx] : undefined;
									const currentGem = gems ? gems[socketIdx] : undefined;
									if (previousGem?.id !== currentGem?.id) {
										changedGems.push(socketIdx);
									}
								});

								item.allSocketColors().forEach((socketColor, gemIdx) => {
									const hasChangedSocket = changedGems.includes(gemIdx);
									const socketRef = ref<HTMLDivElement>();
									const gemName = gems[gemIdx]?.name;
									socketsContainerRef.value?.appendChild(
										<div
											ref={socketRef}
											className={clsx('gem-socket-container', hasChangedSocket && 'interactive')}
											style={{
												backgroundImage: `url(${getEmptyGemSocketIconUrl(socketColor)})`,
											}}>
											{hasChangedSocket && (
												<>
													<i className={'d-block fas fa-exclamation-circle'}></i>
												</>
											)}
										</div>,
									);
									if (hasChangedSocket && gemName)
										tippy(socketRef.value!, {
											content: (
												<>
													<strong>
														{slotName} - Socket {gemIdx + 1}
													</strong>
													<br />
													{gemName}
												</>
											),
										});
								});
							}
						}

						return <li>{itemElement}</li>;
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
					postClickEvent: () => this.reforgeDoneToast?.hide(),
				});
		}

		trackEvent({
			action: 'settings',
			category: 'reforging',
			label: 'suggest_success',
		});
		this.reforgeDoneToast = new Toast({
			additionalClasses: ['suggest-reforges-toast'],
			variant: 'success',
			body: hasReforgeChanges ? changedReforgeMessage : <>{i18n.t('gear_tab.reforge_success.no_changes')}</>,
			autohide: !hasReforgeChanges,
			delay: 3000,
		});
	}

	onReforgeError(error: any) {
		if (isDevMode()) console.log(error);

		if (this.previousGear) void this.player.setGearAsync(TypedEvent.nextEventID(), this.previousGear);
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

	onReforgeFinally() {
		this.progressTrackerModal.hide();

		if (this.wasCM) {
			this.simUI.player.setChallengeModeEnabled(TypedEvent.nextEventID(), true);
		}
		performance.mark('reforge-optimization-end');
		const completionTimeInMs = performance.measure('reforge-optimization-measure', 'reforge-optimization-start', 'reforge-optimization-end').duration;
		if (isDevMode()) console.log('Reforge optimization took:', `${completionTimeInMs.toFixed(2)}ms`);

		trackEvent({
			action: 'settings',
			category: 'reforging',
			label: 'suggest_duration',
			value: Math.ceil(completionTimeInMs / 1000),
		});
	}

	async abortReforgeOptimization() {
		await this.sim.signalManager.abortType(RequestTypes.ReforgeOptimize);
	}

	fromProto(eventID: EventID, proto: ReforgeSettings) {
		TypedEvent.freezeAllAndDo(() => {
			this.setUseCustomEPValues(eventID, proto.useCustomEpValues);
			this.setStatCaps(eventID, Stats.fromProto(proto.statCaps));
			this.setUseSoftCapBreakpoints(eventID, proto.useSoftCapBreakpoints);
			this.setIncludeGems(eventID, proto.includeGems);
			this.setIncludeEOTBPGemSocket(eventID, proto.includeEotbGemSocket);
			this.setFreezeItemSlots(eventID, proto.freezeItemSlots);
			this.setFrozenItemSlots(eventID, proto.frozenItemSlots);
			this.setBreakpointLimits(eventID, Stats.fromProto(proto.breakpointLimits));
			if (proto.relativeStatCapStat) {
				this.setRelativeStatCap(eventID, UnitStat.fromProto(proto.relativeStatCapStat).getStat());
			}
			this.setRelativeStatCapPrecision(eventID, proto.relativeStatCapMipGap || 0.0001);
		});
	}

	toProto(): ReforgeSettings {
		return ReforgeSettings.create({
			useCustomEpValues: this.useCustomEPValues,
			useSoftCapBreakpoints: this.useSoftCapBreakpoints,
			includeGems: this.includeGems,
			includeEotbGemSocket: this.includeEOTBPGemSocket,
			freezeItemSlots: this.freezeItemSlots,
			frozenItemSlots: [...this.frozenItemSlots],
			breakpointLimits: this.breakpointLimits.toProto(),
			relativeStatCapStat: this.relativeStatCap?.forcedHighestStat.toProto(),
			relativeStatCapMipGap: this.relativeStatCap ? this.relativeStatCapPrecision : 0,
			statCaps: this.statCaps.toProto(),
		});
	}

	applyDefaults(eventID: EventID) {
		TypedEvent.freezeAllAndDo(() => {
			this.setUseCustomEPValues(eventID, false);
			this.setUseSoftCapBreakpoints(eventID, !!this.simUI.individualConfig.defaults.softCapBreakpoints?.length);
			this.setIncludeGems(eventID, false);
			this.setIncludeEOTBPGemSocket(eventID, false);
			this.setFreezeItemSlots(eventID, false);
			this.setStatCaps(eventID, this.simUI.individualConfig.defaults.statCaps || new Stats());
			this.setBreakpointLimits(eventID, this.simUI.individualConfig.defaults.breakpointLimits || new Stats());
			this.setSoftCapBreakpoints(eventID, this.simUI.individualConfig.defaults.softCapBreakpoints || []);
			this.setRelativeStatCap(eventID, this.relativeStatCapStat);
			this.setRelativeStatCapPrecision(eventID, 0.0001);
		});
	}
}
