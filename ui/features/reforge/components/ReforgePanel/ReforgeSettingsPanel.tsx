import type { ReforgeOptimizerModel, ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import { SavedEpWeights } from '@features/stat-weights/components/SavedEpWeights';
import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { UnitStat } from '@sim/proto/stats';
import { RelativeStatCap } from '@sim/settings/reforge_settings';
import { batch } from '@sim/state/batch';
import { subscribeAll, subscribePlayerField, subscribeReforgeField } from '@sim/state/subscriptions';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import clsx from 'clsx';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useReforgeField } from '../../hooks/useReforgeField';
import { ReforgeBreakpointLimits } from './ReforgeBreakpointLimits';
import { ReforgeFrozenSlots } from './ReforgeFrozenSlots';
import { ReforgeStatCaps } from './ReforgeStatCaps';
import { buildStatTooltips } from './statTooltips';

export interface ReforgeSettingsPanelProps {
	model: ReforgeOptimizerModel;
	options?: ReforgeOptimizerOptions;
	/** Closes the popover, which is what `hideAll()` did when the EP weights dialog opened over it. */
	onClose: () => void;
}

/** The popover's body. Mounted only while the popover is open, so every section is built per open — the lifetime tippy's `onShow`/`onHidden` pair hand-rolled. */
export const ReforgeSettingsPanel = ({ model, options, onClose }: ReforgeSettingsPanelProps) => {
	const host = useSimHost();
	const player = host.player;
	const settings = model.settings;

	const useCustomEPValues = useReforgeField(settings, 'useCustomEPValues', () => settings.useCustomEPValues);
	const useSoftCapBreakpoints = useReforgeField(settings, 'useSoftCapBreakpoints', () => settings.useSoftCapBreakpoints);
	const freezeItemSlots = useReforgeField(settings, 'freezeItemSlots', () => settings.freezeItemSlots);

	const statTooltips = useMemo(() => buildStatTooltips(options?.statTooltips), [options]);
	const hasSoftCaps = !!model.softCapsConfig?.length;

	const forcedProcSubscribe = useMemo(
		() => subscribeAll([subscribeReforgeField(settings, 'relativeStatCapStat'), subscribePlayerField(player, 'gear')]),
		[settings, player],
	);
	const precisionSubscribe = useMemo(
		() =>
			subscribeAll([
				subscribeReforgeField(settings, 'relativeStatCapPrecision'),
				subscribeReforgeField(settings, 'relativeStatCapStat'),
				subscribePlayerField(player, 'gear'),
			]),
		[settings, player],
	);
	const eotbpSubscribe = useMemo(
		() =>
			subscribeAll([
				subscribeReforgeField(settings, 'includeGems'),
				subscribeReforgeField(settings, 'includeEOTBPGemSocket'),
				subscribePlayerField(player, 'gear'),
			]),
		[settings, player],
	);

	return (
		<>
			<BooleanPicker
				modObject={player}
				config={{
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-enable-custom-ep-weights',
					label: i18n.t('sidebar.buttons.suggest_reforges.use_custom'),
					inline: true,
					storeSubscribe: () => subscribeReforgeField(settings, 'useCustomEPValues'),
					getValue: () => settings.useCustomEPValues,
					setValue: (_player, newValue) => {
						trackEvent({ action: 'settings', category: 'reforging', label: 'use_custom_ep', value: newValue });
						model.setUseCustomEPValues(newValue);
					},
				}}
			/>
			<div className={clsx('mb-0', useCustomEPValues && 'hide')}>
				<p>{i18n.t('sidebar.buttons.suggest_reforges.enable_modification')}</p>
				<p>{i18n.t('sidebar.buttons.suggest_reforges.modify_in_editor')}</p>
				<p>{i18n.t('sidebar.buttons.suggest_reforges.hard_cap_info')}</p>
			</div>
			<ReforgeStatCaps
				model={model}
				player={player}
				displayStats={host.individualConfig.displayStats}
				statTooltips={statTooltips}
				useCustomEPValues={useCustomEPValues}
			/>
			{hasSoftCaps && (
				<BooleanPicker
					modObject={player}
					config={{
						extraCssClasses: ['mb-2'],
						id: 'reforge-optimizer-enable-soft-cap-breakpoints',
						label: i18n.t('sidebar.buttons.suggest_reforges.use_soft_cap_breakpoints'),
						inline: true,
						storeSubscribe: () => subscribeReforgeField(settings, 'useSoftCapBreakpoints'),
						getValue: () => settings.useSoftCapBreakpoints,
						setValue: (_player, newValue) => {
							trackEvent({ action: 'settings', category: 'reforging', label: 'softcap_breakpoints', value: newValue });
							model.setUseSoftCapBreakpoints(newValue);
						},
					}}
				/>
			)}
			<EnumPicker
				modObject={player}
				config={{
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-force-stat-proc',
					label: i18n.t('sidebar.buttons.suggest_reforges.force_stat_proc'),
					defaultValue: settings.relativeStatCapStat,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.any'), value: -1 },
						...[...RelativeStatCap.relevantStats].map(stat => ({ name: UnitStat.fromStat(stat).getShortName(model.playerClass), value: stat })),
					],
					storeSubscribe: () => forcedProcSubscribe,
					getValue: () => settings.relativeStatCapStat,
					setValue: (_player, newValue) => model.setRelativeStatCap(newValue),
					showWhen: () => {
						// The vanilla `showWhen` derived `relativeStatCap` as a side effect; it writes no store field, so it stays here rather than becoming an effect.
						const canEnable = RelativeStatCap.hasRoRo(player);
						if (!canEnable || settings.relativeStatCapStat === -1) {
							settings.relativeStatCap = null;
						} else if (!settings.relativeStatCap && settings.relativeStatCapStat) {
							settings.relativeStatCap = new RelativeStatCap(settings.relativeStatCapStat);
						}
						return canEnable;
					},
				}}
			/>
			<EnumPicker
				modObject={player}
				config={{
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-relcap-precision',
					label: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision_tooltip'),
					defaultValue: settings.relativeStatCapPrecision,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_precise'), value: 0.0001 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_balanced'), value: 0.0005 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_fast'), value: 0.005 },
					],
					storeSubscribe: () => precisionSubscribe,
					getValue: () => settings.relativeStatCapPrecision,
					setValue: (_player, newValue) => model.setRelativeStatCapPrecision(newValue),
					showWhen: () => RelativeStatCap.hasRoRo(player) && settings.relativeStatCapStat !== -1,
				}}
			/>
			{model.enableBreakpointLimits && hasSoftCaps && (
				<ReforgeBreakpointLimits model={model} player={player} useSoftCapBreakpoints={useSoftCapBreakpoints} />
			)}
			<BooleanPicker
				modObject={player}
				config={{
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-include-gems',
					label: i18n.t('sidebar.buttons.suggest_reforges.include_gems'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.optimize_gems_tooltip'),
					inline: true,
					storeSubscribe: () => subscribeReforgeField(settings, 'includeGems'),
					getValue: () => settings.includeGems,
					setValue: (_player, newValue) => {
						trackEvent({ action: 'settings', category: 'reforging', label: 'include_gems', value: newValue });
						batch(() => {
							model.setIncludeGems(newValue);
							model.setIncludeEOTBPGemSocket(player.sim.getPhase() >= 2);
						});
					},
				}}
			/>
			<BooleanPicker
				modObject={player}
				config={{
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-include-eotbp-socket',
					label: i18n.t('sidebar.buttons.suggest_reforges.include_eotbp_socket'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.include_eotbp_socket_tooltip'),
					inline: true,
					storeSubscribe: () => eotbpSubscribe,
					getValue: () => settings.includeEOTBPGemSocket,
					showWhen: () => settings.includeGems && player.hasEotBPItemEquipped(),
					setValue: (_player, newValue) => model.setIncludeEOTBPGemSocket(newValue),
				}}
			/>
			<BooleanPicker
				modObject={player}
				config={{
					extraCssClasses: ['mb-2'],
					id: 'reforge-optimizer-freeze-item-slots',
					label: i18n.t('sidebar.buttons.suggest_reforges.freeze_item_slots'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.freeze_item_slots_tooltip'),
					inline: true,
					storeSubscribe: () => subscribeReforgeField(settings, 'freezeItemSlots'),
					getValue: () => settings.freezeItemSlots,
					setValue: (_player, newValue) => {
						trackEvent({ action: 'settings', category: 'reforging', label: 'freeze_item_slots', value: newValue });
						model.setFreezeItemSlots(newValue);
					},
				}}
			/>
			<ReforgeFrozenSlots model={model} player={player} freezeItemSlots={freezeItemSlots} />
			<SavedEpWeights className="mt-3" loadOnly presetsOnly={!useCustomEPValues} />
			{host.epWeightsModal && (
				<Button
					variant="outline-primary"
					className="mt-2"
					onClick={() => {
						host.epWeightsModal?.open();
						onClose();
					}}>
					{i18n.t('sidebar.buttons.suggest_reforges.edit_weights')}
				</Button>
			)}
		</>
	);
};
