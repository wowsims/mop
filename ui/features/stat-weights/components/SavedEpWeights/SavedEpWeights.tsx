import { useSimHost } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Stats } from '@sim/proto/stats';
import { subscribePlayerField } from '@sim/state/subscriptions';
import type { SavedEPWeights } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import { useCallback, useMemo } from 'react';

import { trackEvent } from '../../../../tracking/analytics';
import { useSavedEpWeights } from '../../hooks/useSavedEpWeights';
import { epWeightsData, serializeEpWeights } from './utils';

export const SavedEpWeights = () => {
	const host = useSimHost();
	const { player, sim, individualConfig } = host;
	const ready = useSimReady();

	const label = i18n.t('sidebar.buttons.stat_weights.modal.ep');
	const { entries: userData, save, remove } = useSavedEpWeights();

	const presets = useMemo<Array<SavedDataPanelEntry<SavedEPWeights>>>(
		() =>
			ready
				? individualConfig.presets.epWeights.map(preset => {
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

	const epWeights = useStoreSubscribe(
		useMemo(() => subscribePlayerField(player, 'epWeights'), [player]),
		() => player.getEpWeights(),
	);
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
			title={i18n.t('sidebar.buttons.stat_weights.saved_ep_weights.title')}
			label={label}
			nameLabel={i18n.t('sidebar.buttons.stat_weights.title')}
			presets={presets}
			userData={userData}
			currentJson={currentJson}
			onLoad={onLoad}
			onSave={onSave}
			onDelete={onDelete}
		/>
	);
};
