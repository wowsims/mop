import type { ReforgeOptimizerModel, ReforgeOptimizerOptions } from '@features/reforge/model/reforge_optimizer';
import { SavedEpWeights } from '@features/stat-weights/components/SavedEpWeights';
import { useOpenEpWeights } from '@features/stat-weights/hooks/useEpWeightsDialog';
import i18n from '@i18n/config';
import { useSimHost, useSpecConfig } from '@sim/context/SimHostContext';
import { UnitStat } from '@sim/proto/stats';
import { RelativeStatCap } from '@sim/settings/reforge_settings';
import { batch } from '@sim/state/batch';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { Button } from '@ui-kit/Button';
import { EnumPicker } from '@ui-kit/EnumPicker';
import { useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useReforgeField } from '../../hooks/useReforgeField';
import { ReforgeBreakpointLimits } from './ReforgeBreakpointLimits';
import { ReforgeFrozenSlots } from './ReforgeFrozenSlots';
import { DEFAULT_REFORGE_ID_PREFIX, ReforgeIdPrefixContext } from './ReforgeIdPrefixContext';
import { ReforgeStatCaps } from './ReforgeStatCaps';
import { buildStatTooltips } from './utils';

export interface ReforgeSettingsPanelProps {
	model: ReforgeOptimizerModel;
	options?: ReforgeOptimizerOptions;
	/** Closes the popover when the EP weights dialog opens over it. Omitted where the panel is inline and has nothing to close. */
	onClose?: () => void;
	/** Scopes every DOM id, so a second mount does not collide with the sidebar popover's. */
	idPrefix?: string;
	/** Renders the gem rows as forced-on and read-only, the way the batch sim runs them. */
	gemsLocked?: boolean;
}

/** The reforge settings body, shared by the sidebar popover and the Batch Sim sidebar. In the popover it is mounted only while that is open, so every section is built per open. */
export const ReforgeSettingsPanel = ({ model, options, onClose, idPrefix = DEFAULT_REFORGE_ID_PREFIX, gemsLocked = false }: ReforgeSettingsPanelProps) => {
	const host = useSimHost();
	const player = host.player;
	const individualConfig = useSpecConfig();
	const openEpWeights = useOpenEpWeights();
	const settings = model.settings;

	const useCustomEPValues = useReforgeField(settings, 'useCustomEPValues', () => settings.useCustomEPValues);
	const useSoftCapBreakpoints = useReforgeField(settings, 'useSoftCapBreakpoints', () => settings.useSoftCapBreakpoints);
	const freezeItemSlots = useReforgeField(settings, 'freezeItemSlots', () => settings.freezeItemSlots);

	const statTooltips = useMemo(() => buildStatTooltips(options?.statTooltips), [options]);
	const softCapsConfig = model.softCapsConfig;
	const hasSoftCaps = !!softCapsConfig?.length;

	return (
		<ReforgeIdPrefixContext.Provider value={idPrefix}>
			<BooleanPicker
				modObject={player}
				config={{
					extraClassNames: ['mb-2'],
					id: `${idPrefix}-enable-custom-ep-weights`,
					label: i18n.t('sidebar.buttons.suggest_reforges.use_custom'),
					layout: 'inline',
					storeField: 'reforge:useCustomEPValues',
					getValue: () => settings.useCustomEPValues,
					setValue: (_player, newValue) => {
						trackEvent({ action: 'settings', category: 'reforging', label: 'use_custom_ep', value: newValue });
						settings.setUseCustomEPValues(newValue);
					},
				}}
			/>
			{!useCustomEPValues && (
				<div className="mb-0">
					<p>{i18n.t('sidebar.buttons.suggest_reforges.enable_modification')}</p>
					<p>{i18n.t('sidebar.buttons.suggest_reforges.modify_in_editor')}</p>
					<p>{i18n.t('sidebar.buttons.suggest_reforges.hard_cap_info')}</p>
				</div>
			)}
			<ReforgeStatCaps
				model={model}
				player={player}
				displayStats={individualConfig.displayStats}
				statTooltips={statTooltips}
				useCustomEPValues={useCustomEPValues}
			/>
			{hasSoftCaps && (
				<BooleanPicker
					modObject={player}
					config={{
						extraClassNames: ['mb-2'],
						id: `${idPrefix}-enable-soft-cap-breakpoints`,
						label: i18n.t('sidebar.buttons.suggest_reforges.use_soft_cap_breakpoints'),
						layout: 'inline',
						storeField: 'reforge:useSoftCapBreakpoints',
						getValue: () => settings.useSoftCapBreakpoints,
						setValue: (_player, newValue) => {
							trackEvent({ action: 'settings', category: 'reforging', label: 'softcap_breakpoints', value: newValue });
							settings.setUseSoftCapBreakpoints(newValue);
						},
					}}
				/>
			)}
			<EnumPicker
				modObject={player}
				config={{
					extraClassNames: ['mb-2'],
					id: `${idPrefix}-force-stat-proc`,
					label: i18n.t('sidebar.buttons.suggest_reforges.force_stat_proc'),
					defaultValue: settings.relativeStatCapStat,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.any'), value: -1 },
						...[...RelativeStatCap.relevantStats].map(stat => ({ name: UnitStat.fromStat(stat).getShortName(player.getClass()), value: stat })),
					],
					storeField: ['reforge:relativeStatCapStat', 'gear'],
					getValue: () => settings.relativeStatCapStat,
					setValue: (_player, newValue) => settings.setRelativeStatCap(newValue),
					showWhen: () => {
						// This `showWhen` derives `relativeStatCap` as a side effect; it writes no store field, so it stays here rather than becoming an effect.
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
					extraClassNames: ['mb-2'],
					id: `${idPrefix}-relcap-precision`,
					label: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.relative_stat_cap_precision_tooltip'),
					defaultValue: settings.relativeStatCapPrecision,
					values: [
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_precise'), value: 0.0001 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_balanced'), value: 0.0005 },
						{ name: i18n.t('sidebar.buttons.suggest_reforges.precision_fast'), value: 0.005 },
					],
					storeField: ['reforge:relativeStatCapPrecision', 'reforge:relativeStatCapStat', 'gear'],
					getValue: () => settings.relativeStatCapPrecision,
					setValue: (_player, newValue) => settings.setRelativeStatCapPrecision(newValue),
					showWhen: () => RelativeStatCap.hasRoRo(player) && settings.relativeStatCapStat !== -1,
				}}
			/>
			{model.enableBreakpointLimits && hasSoftCaps && (
				<ReforgeBreakpointLimits settings={settings} softCapsConfig={softCapsConfig} player={player} useSoftCapBreakpoints={useSoftCapBreakpoints} />
			)}
			<BooleanPicker
				modObject={player}
				config={{
					extraClassNames: ['mb-2'],
					id: `${idPrefix}-include-gems`,
					label: i18n.t('sidebar.buttons.suggest_reforges.include_gems'),
					labelTooltip: gemsLocked
						? i18n.t('bulk_tab.settings.reforge_gems_locked')
						: i18n.t('sidebar.buttons.suggest_reforges.optimize_gems_tooltip'),
					layout: 'inline',
					storeField: 'reforge:includeGems',
					getValue: () => gemsLocked || settings.includeGems,
					enableWhen: () => !gemsLocked,
					setValue: (_player, newValue) => {
						trackEvent({ action: 'settings', category: 'reforging', label: 'include_gems', value: newValue });
						batch(() => {
							settings.setIncludeGems(newValue);
							settings.setIncludeEOTBPGemSocket(player.sim.getPhase() >= 2);
						});
					},
				}}
			/>
			<BooleanPicker
				modObject={player}
				config={{
					extraClassNames: ['mb-2'],
					id: `${idPrefix}-include-eotbp-socket`,
					label: i18n.t('sidebar.buttons.suggest_reforges.include_eotbp_socket'),
					labelTooltip: gemsLocked
						? i18n.t('bulk_tab.settings.reforge_gems_locked')
						: i18n.t('sidebar.buttons.suggest_reforges.include_eotbp_socket_tooltip'),
					layout: 'inline',
					storeField: ['reforge:includeGems', 'reforge:includeEOTBPGemSocket', 'sim:phase', 'gear'],
					getValue: () => (gemsLocked ? player.sim.getPhase() >= 2 : settings.includeEOTBPGemSocket),
					enableWhen: () => !gemsLocked,
					showWhen: () => (gemsLocked || settings.includeGems) && player.hasEotBPItemEquipped(),
					setValue: (_player, newValue) => settings.setIncludeEOTBPGemSocket(newValue),
				}}
			/>
			<BooleanPicker
				modObject={player}
				config={{
					extraClassNames: ['mb-2'],
					id: `${idPrefix}-freeze-item-slots`,
					label: i18n.t('sidebar.buttons.suggest_reforges.freeze_item_slots'),
					labelTooltip: i18n.t('sidebar.buttons.suggest_reforges.freeze_item_slots_tooltip'),
					layout: 'inline',
					storeField: 'reforge:freezeItemSlots',
					getValue: () => settings.freezeItemSlots,
					setValue: (_player, newValue) => {
						trackEvent({ action: 'settings', category: 'reforging', label: 'freeze_item_slots', value: newValue });
						settings.setFreezeItemSlots(newValue);
					},
				}}
			/>
			<ReforgeFrozenSlots settings={settings} player={player} freezeItemSlots={freezeItemSlots} />
			<SavedEpWeights className="mt-4" loadOnly presetsOnly={!useCustomEPValues} />
			<Button
				variant="outline-primary"
				className="mt-2"
				data-testid="reforge-edit-weights"
				onClick={() => {
					openEpWeights();
					onClose?.();
				}}>
				{i18n.t('sidebar.buttons.suggest_reforges.edit_weights')}
			</Button>
		</ReforgeIdPrefixContext.Provider>
	);
};
