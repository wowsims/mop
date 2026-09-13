import { useSimHost, useSpecPresets } from '@sim/context/SimHostContext';
import { useSimReady } from '@sim/hooks/useSimReady';
import { Stats } from '@sim/proto/stats';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { useSavedPanel } from '@features/hooks/useSavedPanel';
import type { SavedEPWeights } from '@generated/proto/ui';
import i18n from '@i18n/config';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { SavedDataPanelEntry } from '@ui-kit/SavedDataPanel';
import { SavedDataPanel } from '@ui-kit/SavedDataPanel';
import type { ClassValue } from 'clsx';
import { useMemo } from 'react';

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

	const current = useStoreSubscribe(subscribePlayerField(player, 'epWeights'), () => epWeightsData(player.getEpWeights()));

	const panel = useSavedPanel({
		label,
		storage: useSavedEpWeights(),
		current,
		serialize: serializeEpWeights,
		load: entry => player.setEpWeights(Stats.fromProto(entry.data.epWeights)),
	});

	return (
		<SavedDataPanel
			container={host.rootElem}
			className={className}
			title={i18n.t('sidebar.buttons.stat_weights.saved_ep_weights.title')}
			nameLabel={i18n.t('sidebar.buttons.stat_weights.title')}
			loadOnly={loadOnly || presetsOnly}
			presets={presets}
			{...panel}
			userData={presetsOnly ? NO_USER_DATA : panel.userData}
		/>
	);
};
