import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Stats } from '@sim/proto/stats';
import { subscribePlayerField } from '@sim/state/subscriptions';
import type { SavedEPWeights } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import type { ClassValue } from 'clsx';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedEpWeights } from '../../hooks/useSavedEpWeights';
import { epWeightsData, serializeEpWeights } from './utils';

const NO_USER_DATA: Array<SavedDataPanelEntry<SavedEPWeights>> = [];

export interface SavedEpWeightsProps {
	className?: ClassValue;
	loadOnly?: boolean;
	// Presets only, which also means load only: the user's own saved sets are neither listed nor written.
	presetsOnly?: boolean;
}

export const SavedEpWeights = ({ className, loadOnly, presetsOnly }: SavedEpWeightsProps) => {
	const host = useSimHost();
	const { player } = host;
	const individualConfig = useSpecPresets();
	const ready = useSimReady();

	const label = i18n.t('sidebar.buttons.stat_weights.modal.ep');
	const { entries: userData, save, remove } = useSavedEpWeights();

	const presets = useMemo<Array<SavedDataPanelEntry<SavedEPWeights>>>(
		() =>
			ready
				? individualConfig.epWeights.map(preset => {
						const data = epWeightsData(preset.epWeights);
						return {
							name: preset.name,
							data,
							json: serializeEpWeights(data),
							isPreset: true,
							disabled: !!preset.enableWhen && !preset.enableWhen(player),
							afterLoad: () => preset.onLoad?.(player),
						};
					})
				: [],
		[ready, individualConfig, player],
	);

	const epWeights = useStoreSubscribe(subscribePlayerField(player, 'epWeights'), () => player.getEpWeights());
	const currentJson = useMemo(() => serializeEpWeights(epWeightsData(epWeights)), [epWeights]);

	const onLoad = useCallback(
		(entry: SavedDataPanelEntry<SavedEPWeights>) => {
			player.setEpWeights(Stats.fromProto(entry.data.epWeights));
			trackEvent({ action: 'settings', category: 'load', label });
		},
		[player, label],
	);

	const onSave = useCallback(
		(name: string) => {
			save(name, epWeightsData(player.getEpWeights()));
			trackEvent({ action: 'settings', category: 'save', label });
		},
		[player, label, save],
	);

	const onDelete = useCallback(
		(entry: SavedDataPanelEntry<SavedEPWeights>) => {
			remove(entry.name);
			trackEvent({ action: 'settings', category: 'delete', label });
		},
		[label, remove],
	);

	return (
		<SavedDataPanel
			container={host.rootElem}
			className={className}
			title={i18n.t('sidebar.buttons.stat_weights.saved_ep_weights.title')}
			label={label}
			nameLabel={i18n.t('sidebar.buttons.stat_weights.title')}
			loadOnly={loadOnly || presetsOnly}
			presets={presets}
			userData={presetsOnly ? NO_USER_DATA : userData}
			currentJson={currentJson}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};
