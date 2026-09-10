import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import { useSimStatus } from '@sim/hooks/useSimStatus';
import { SidebarActionButton } from '@ui-kit/SidebarActionButton';

import { trackPageView } from '../../../tracking/analytics';

export const StatWeightsAction = () => {
	const host = useSimHost();
	// Weights are computed against the item database, so the button spins until init settles and
	// stays disabled if it fails.
	const { status } = useSimStatus(host.sim);

	return (
		<SidebarActionButton
			className="ep-weights-action"
			disabled={status !== 'ready'}
			loading={status === 'loading'}
			onClick={() => {
				trackPageView('Stat Weights', '/stat-weights');
				host.epWeightsModal?.open();
			}}>
			{i18n.t('sidebar.buttons.stat_weights.title')}
		</SidebarActionButton>
	);
};
