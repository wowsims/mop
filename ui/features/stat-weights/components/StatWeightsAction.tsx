import i18n from '@i18n/config';
import { useSim } from '@sim/context/SimHostContext';
import { useSimStatus } from '@sim/hooks/useSimStatus';
import { SidebarActionButton } from '@ui-kit/SidebarActionButton';

import { trackPageView } from '../../../tracking/analytics';
import { useOpenEpWeights } from '../hooks/useEpWeightsDialog';

export const StatWeightsAction = () => {
	const openEpWeights = useOpenEpWeights();
	// Weights are computed against the item database, so the button spins until init settles and
	// stays disabled if it fails.
	const { status } = useSimStatus(useSim());

	return (
		<SidebarActionButton
			className="ep-weights-action"
			disabled={status !== 'ready'}
			loading={status === 'loading'}
			onClick={() => {
				trackPageView('Stat Weights', '/stat-weights');
				openEpWeights();
			}}>
			{i18n.t('sidebar.buttons.stat_weights.title')}
		</SidebarActionButton>
	);
};
