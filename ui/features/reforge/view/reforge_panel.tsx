import { CopyButton } from '@core/components/copy_button';
import { buildGearChangeIcon } from '@core/components/gear_change_icon';
import { BooleanPicker } from '@core/components/pickers/boolean_picker';
import { EnumPicker } from '@core/components/pickers/enum_picker';
import { NumberPicker, NumberPickerConfig } from '@core/components/pickers/number_picker';
import { ProgressTrackerModal } from '@core/components/progress_tracker_modal';
import { renderSavedEPWeights } from '@core/components/saved_data_managers/ep_weights';
import Toast from '@core/components/toast';
import type { IndividualSimUI } from '@core/individual_sim_ui';
import { Player } from '@core/player';
import { ReforgeSettings, StatCapType } from '@core/proto/api';
import { ItemSlot, Stat } from '@core/proto/common';
import { IndividualSimSettings } from '@core/proto/ui';
import { EquippedItem } from '@core/proto_utils/equipped_item';
import { Gear } from '@core/proto_utils/gear';
import { statCapTypeNames } from '@core/proto_utils/names';
import { StatCap, Stats, UnitStat } from '@core/proto_utils/stats';
import { RelativeStatCap } from '@core/reforge_settings';
import { ActionGroupItem } from '@core/sim_ui';
import { batch, EventID, nextEventID } from '@core/state/batch';
import { subscribeAll, subscribePlayerField, subscribeReforgeChange, subscribeReforgeField } from '@core/state/subscriptions';
import { isDevMode } from '@core/utils';
import { ReforgeOptimizerContext, ReforgeOptimizerModel, ReforgeOptimizerOptions, StatTooltipContent } from '@features/reforge/model/reforge_optimizer';
import i18n from '@i18n/config';
import { translateSlotName } from '@i18n/localization';
import clsx from 'clsx';
import tippy, { hideAll } from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { trackEvent, trackPageView } from '../../../tracking/utils';

// The model types are part of the panel's public surface — spec configs import
// `ReforgeOptimizer` and `ReforgeOptimizerOptions` from this module.
export { ReforgeOptimizerModel };
export type { ReforgeOptimizerContext, ReforgeOptimizerOptions, StatTooltipContent };

const INCLUDED_STATS = [
	Stat.StatHitRating,
	Stat.StatCritRating,
	Stat.StatHasteRating,
	Stat.StatExpertiseRating,
	Stat.StatMasteryRating,
	Stat.StatDodgeRating,
	Stat.StatParryRating,
];

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

export class ReforgeOptimizer {
	readonly model: ReforgeOptimizerModel;
	protected readonly simUI: IndividualSimUI<any>;
	protected readonly player: Player<any>;
	protected reforgeDoneToast: Toast | null = null;
	protected progressTrackerModal: ProgressTrackerModal;
	protected statTooltips: StatTooltipContent = {};
	protected additionalSoftCapTooltipInformation: StatTooltipContent = {};
	protected wasCM: boolean = false;
	protected isCancelling: boolean = false;

	constructor(simUI: IndividualSimUI<any>, options?: ReforgeOptimizerOptions) {
		this.simUI = simUI;
		this.player = simUI.player;
		this.statTooltips = { ...STAT_TOOLTIPS, ...options?.statTooltips };
		this.additionalSoftCapTooltipInformation = { ...options?.additionalSoftCapTooltipInformation };
		this.model = new ReforgeOptimizerModel(simUI.sim, simUI.player, {
			...options,
			defaults: simUI.individualConfig.defaults,
			epStats: simUI.individualConfig.epStats,
		});
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
				if (this.previousGear) this.player.setGear(nextEventID(), this.previousGear);
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
						simUI.player.setChallengeModeEnabled(nextEventID(), false);
					}
					const gear = await this.optimizeReforges();
					await this.player.setGearAsync(nextEventID(), gear);
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
	}

	// Model surface kept on the panel, so `simUI.reforger` reads the same as before
	// the model/view split.
	get settings() {
		return this.model.settings;
	}

	get defaults() {
		return this.model.defaults;
	}

	get previousGear() {
		return this.model.previousGear;
	}

	get softCapsConfig() {
		return this.model.softCapsConfig;
	}

	get softCapsConfigWithLimits() {
		return this.model.softCapsConfigWithLimits;
	}

	get preCapEPs(): Stats {
		return this.model.preCapEPs;
	}

	get statCaps() {
		return this.model.statCaps;
	}

	get isAllowedToOverrideStatCaps() {
		return this.model.isAllowedToOverrideStatCaps;
	}

	get processedStatCaps() {
		return this.model.processedStatCaps;
	}

	setStatCaps(eventID: EventID, newStatCaps: Stats) {
		this.model.setStatCaps(eventID, newStatCaps);
	}

	setUseCustomEPValues(eventID: EventID, newUseCustomEPValues: boolean) {
		this.model.setUseCustomEPValues(eventID, newUseCustomEPValues);
	}

	setUseSoftCapBreakpoints(eventID: EventID, newUseSoftCapBreakpoints: boolean) {
		this.model.setUseSoftCapBreakpoints(eventID, newUseSoftCapBreakpoints);
	}

	setBreakpointLimits(eventID: EventID, newLimits: Stats) {
		this.model.setBreakpointLimits(eventID, newLimits);
	}

	setRelativeStatCap(eventID: EventID, newValue: number) {
		this.model.setRelativeStatCap(eventID, newValue);
	}
	setRelativeStatCapPrecision(eventID: EventID, newValue: number) {
		this.model.setRelativeStatCapPrecision(eventID, newValue);
	}

	setIncludeGems(eventID: EventID, newValue: boolean) {
		this.model.setIncludeGems(eventID, newValue);
	}

	setIncludeEOTBPGemSocket(eventID: EventID, newValue: boolean) {
		this.model.setIncludeEOTBPGemSocket(eventID, newValue);
	}

	setFreezeItemSlots(eventID: EventID, newValue: boolean) {
		this.model.setFreezeItemSlots(eventID, newValue);
	}

	setFrozenItemSlot(eventID: EventID, slot: ItemSlot, frozen: boolean) {
		this.model.setFrozenItemSlot(eventID, slot, frozen);
	}

	getFrozenItemSlot(slot: ItemSlot): boolean {
		return this.model.getFrozenItemSlot(slot);
	}

	getReforgeOptimizeConfig(gear: Gear) {
		return this.model.getReforgeOptimizeConfig(gear);
	}

	optimizeReforges(gear?: Gear) {
		return this.model.optimizeReforges(gear);
	}

	async abortReforgeOptimization() {
		await this.model.abortReforgeOptimization();
	}

	fromProto(eventID: EventID, proto: ReforgeSettings) {
		this.model.fromProto(eventID, proto);
	}

	toProto(): ReforgeSettings {
		return this.model.toProto();
	}

	applyDefaults(eventID: EventID) {
		this.model.applyDefaults(eventID);
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
										{unitStat.getShortName(this.model.playerClass)}
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
										<td className="text-end">{this.model.breakpointValueToDisplayPercentage(breakpoint, unitStat)}</td>
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
					storeSubscribe: () => subscribeReforgeField(this.settings, 'useCustomEPValues'),
					getValue: () => this.settings.useCustomEPValues,
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
						storeSubscribe: () => subscribeReforgeField(this.settings, 'useSoftCapBreakpoints'),
						getValue: () => this.settings.useSoftCapBreakpoints,
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
					defaultValue: this.settings.relativeStatCapStat,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.any'), value: -1 },
						...[...RelativeStatCap.relevantStats].map(stat => {
							return {
								name: UnitStat.fromStat(stat).getShortName(this.model.playerClass),
								value: stat,
							};
						}),
					],
					storeSubscribe: () =>
						subscribeAll([subscribeReforgeField(this.settings, 'relativeStatCapStat'), subscribePlayerField(this.player, 'gear')]),
					getValue: () => {
						return this.settings.relativeStatCapStat;
					},
					setValue: (_eventID, _player, newValue) => {
						this.setRelativeStatCap(nextEventID(), newValue);
					},
					showWhen: () => {
						const canEnable = RelativeStatCap.hasRoRo(this.player);

						if (!canEnable || this.settings.relativeStatCapStat === -1) {
							this.settings.relativeStatCap = null;
						} else if (!this.settings.relativeStatCap && this.settings.relativeStatCapStat) {
							this.settings.relativeStatCap = new RelativeStatCap(this.settings.relativeStatCapStat);
						}

						return canEnable;
					},
				});

				const relativeStatCapPrecisionInput = new EnumPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-relcap-precision',
					label: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision_tooltip'),
					defaultValue: this.settings.relativeStatCapPrecision,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_precise'), value: 0.0001 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_balanced'), value: 0.0005 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_fast'), value: 0.005 },
					],
					storeSubscribe: () =>
						subscribeAll([
							subscribeReforgeField(this.settings, 'relativeStatCapPrecision'),
							subscribeReforgeField(this.settings, 'relativeStatCapStat'),
							subscribePlayerField(this.player, 'gear'),
						]),
					getValue: () => this.settings.relativeStatCapPrecision,
					setValue: (_eventID, _player, newValue) => {
						this.setRelativeStatCapPrecision(nextEventID(), newValue);
					},
					showWhen: () => RelativeStatCap.hasRoRo(this.player) && this.settings.relativeStatCapStat !== -1,
				});

				const includeGemsInput = new BooleanPicker(null, this.player, {
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-include-gems',
					label: i18n.t('sidebar.buttons.suggest_reforges.include_gems'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.optimize_gems_tooltip'),
					inline: true,
					storeSubscribe: () => subscribeReforgeField(this.settings, 'includeGems'),
					getValue: () => this.settings.includeGems,
					setValue: (eventID, _player, newValue) => {
						trackEvent({
							action: 'settings',
							category: 'reforging',
							label: 'include_gems',
							value: newValue,
						});
						batch(() => {
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
					storeSubscribe: () =>
						subscribeAll([
							subscribeReforgeField(this.settings, 'includeGems'),
							subscribeReforgeField(this.settings, 'includeEOTBPGemSocket'),
							subscribePlayerField(this.player, 'gear'),
						]),
					getValue: () => this.settings.includeEOTBPGemSocket,
					showWhen: () => this.settings.includeGems && this.player.hasEotBPItemEquipped(),
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
					storeSubscribe: () => subscribeReforgeField(this.settings, 'freezeItemSlots'),
					getValue: () => this.settings.freezeItemSlots,
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
						<div ref={descriptionRef} className={clsx('mb-0', this.settings.useCustomEPValues && 'hide')}>
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
			<table className={clsx('mb-2', { 'd-none': !this.settings.freezeItemSlots })} ref={tableRef}>
				{slotsByRow.map(slots => {
					const rowRef = ref<HTMLTableRowElement>();
					const row = (
						<tr ref={rowRef}>
							{slots.map(slot => {
								const picker = new BooleanPicker(null, this.player, {
									id: 'reforge-optimizer-freeze-' + ItemSlot[slot],
									label: translateSlotName(slot),
									inline: true,
									storeSubscribe: () => subscribeReforgeField(this.settings, 'freezeItemSlots'),
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

		subscribeReforgeField(
			this.settings,
			'freezeItemSlots',
		)(() => {
			tableRef.value?.classList[this.settings.freezeItemSlots ? 'remove' : 'add']('d-none');
		});

		return content;
	}

	buildCapsList({ useCustomEPValuesInput, description }: { useCustomEPValuesInput: BooleanPicker<Player<any>>; description: HTMLElement }) {
		const sharedInputConfig: Pick<NumberPickerConfig<Player<any>>, 'storeSubscribe'> = {
			storeSubscribe: () =>
				subscribeAll([subscribeReforgeField(this.settings, 'useSoftCapBreakpoints'), subscribeReforgeField(this.settings, 'statCaps')]),
		};

		const tableRef = ref<HTMLTableElement>();
		const statCapTooltipRef = ref<HTMLButtonElement>();
		const defaultStatCapsButtonRef = ref<HTMLButtonElement>();

		const content = (
			<table ref={tableRef} className={clsx('reforge-optimizer-stat-cap-table mb-2', !this.settings.useCustomEPValues && 'hide')}>
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
									onclick={() => this.setStatCaps(nextEventID(), this.defaults.statCaps || new Stats())}>
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
								return this.model.toVisualUnitStatPercentage(this.statCaps.getUnitStat(unitStat), unitStat);
							},
							setValue: (_eventID, _player, newValue) => {
								this.setStatCaps(nextEventID(), this.statCaps.withUnitStat(unitStat, this.model.toDefaultUnitStatValue(newValue, unitStat)));
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
							storeSubscribe: () => subscribeReforgeChange(this.settings),
							getValue: () => this.settings.undershootCaps.getUnitStat(unitStat) > 0,
							setValue: (_eventID, _player, newValue) => {
								this.settings.undershootCaps = this.settings.undershootCaps.withUnitStat(unitStat, newValue ? 1 : 0);
							},
						});

						const statPresets = this.model.statSelectionPresets?.find(entry => entry.unitStat.equals(unitStat))?.presets;
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

		const unsubUseCustom = subscribeReforgeField(
			this.settings,
			'useCustomEPValues',
		)(() => {
			tableRef.value?.classList[this.settings.useCustomEPValues ? 'remove' : 'add']('hide');
			description?.classList[!this.settings.useCustomEPValues ? 'remove' : 'add']('hide');
		});

		useCustomEPValuesInput.addOnDisposeCallback(() => {
			content.remove();
			unsubUseCustom();
			this.settings.undershootCaps = new Stats();
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
					presetsOnly: !this.settings.useCustomEPValues,
				});
				container.replaceChildren(epPicker.rootElem);
			}
		};

		subscribeReforgeField(this.settings, 'useCustomEPValues')(() => render());
		render();

		return content;
	}

	buildSoftCapBreakpointsLimiter({ useSoftCapBreakpointsInput }: { useSoftCapBreakpointsInput: BooleanPicker<Player<any>> | null }) {
		if (!this.model.enableBreakpointLimits || !useSoftCapBreakpointsInput) return null;

		const tableRef = ref<HTMLTableElement>();
		const breakpointsLimitTooltipRef = ref<HTMLButtonElement>();

		const content = (
			<table ref={tableRef} className={clsx('reforge-optimizer-stat-cap-table mb-2', !this.settings.useSoftCapBreakpoints && 'hide')}>
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
												name: `${this.model.breakpointValueToDisplayPercentage(breakpoint, unitStat)}%`,
												value: breakpoint,
											})),
										].sort((a, b) => a.value - b.value),
										storeSubscribe: () => subscribeReforgeField(this.settings, 'useSoftCapBreakpoints'),
										getValue: () => {
											const breakpointLimits = this.settings.breakpointLimits;
											let limit = breakpointLimits.getUnitStat(unitStat);
											if (!breakpoints.some(breakpoint => breakpoint == limit)) {
												limit = 0;
											}

											return limit;
										},
										setValue: (eventID, _player, newValue) => {
											this.setBreakpointLimits(eventID, this.settings.breakpointLimits.withUnitStat(unitStat, newValue));
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

		const unsubSoftCaps = subscribeReforgeField(
			this.settings,
			'useSoftCapBreakpoints',
		)(() => {
			const isUsingBreakpoints = this.settings.useSoftCapBreakpoints;
			tableRef.value?.classList[isUsingBreakpoints ? 'remove' : 'add']('hide');
		});

		useSoftCapBreakpointsInput.addOnDisposeCallback(() => {
			content.remove();
			unsubSoftCaps();
		});

		return content;
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
						return <li>{buildGearChangeIcon(this.player, slot, item, this.previousGear?.getEquippedItem(slot) ?? undefined)}</li>;
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

		if (this.previousGear) void this.player.setGearAsync(nextEventID(), this.previousGear);
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
			this.simUI.player.setChallengeModeEnabled(nextEventID(), true);
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
}
