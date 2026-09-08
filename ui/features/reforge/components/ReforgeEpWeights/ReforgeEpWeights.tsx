import { subscribeReforgeField } from '@sim/state/subscriptions';
import { SavedEpWeights } from '@features/stat-weights/components/SavedEpWeights';
import { useStoreSubscribe } from '@ui-kit/hooks/useStoreSubscribe';
import { useMemo, useSyncExternalStore } from 'react';

import type { ReforgeOptimizer } from '../../view/reforge_panel';

export interface ReforgeEpWeightsProps {
	panel: ReforgeOptimizer;
}

export const ReforgeEpWeights = ({ panel }: ReforgeEpWeightsProps) => {
	const open = useSyncExternalStore(panel.subscribeEpWeightsOpen, panel.isEpWeightsOpen, panel.isEpWeightsOpen);
	const settings = panel.settings;
	const useCustomEPValues = useStoreSubscribe(
		useMemo(() => subscribeReforgeField(settings, 'useCustomEPValues'), [settings]),
		() => settings.useCustomEPValues,
	);

	if (!open) return null;

	return <SavedEpWeights className="mt-3" loadOnly presetsOnly={!useCustomEPValues} />;
};
