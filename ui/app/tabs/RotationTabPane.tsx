import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { usePlayer } from '@sim/context/SimHostContext';
import { useAplRotation } from '@sim/hooks/useAplRotation';
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
	const rotationType = useAplRotation(() => player.getRotationType());

	return (
		<SimTabPane id="rotation-tab" className={ROTATION_TYPE_CLASSES[rotationType]}>
			<RotationTabBody />
		</SimTabPane>
	);
};
