import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { usePlayer } from '@sim/context/SimHostContext';
import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import { subscribePlayerField } from '@sim/state/subscriptions';
import { SimTabPane } from '@ui-kit/SimTabPane';

import { RotationTabBody } from './RotationTabBody';

// The three sub-tabs are all rendered; this class on the pane is what shows one of them.
const ROTATION_TYPE_CLASSES: Record<number, string> = {
	[APLRotationType.TypeAuto]: 'rotation-type-auto',
	[APLRotationType.TypeSimple]: 'rotation-type-simple',
	[APLRotationType.TypeAPL]: 'rotation-type-apl',
};

export const RotationTabPane = () => {
	const player = usePlayer();
	const subscribe = subscribePlayerField(player, 'rotation');
	const rotationType = useStoreSubscribe(subscribe, () => player.getRotationType());

	return (
		<SimTabPane id="rotation-tab" className={ROTATION_TYPE_CLASSES[rotationType]}>
			<RotationTabBody />
		</SimTabPane>
	);
};
