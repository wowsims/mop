import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { usePlayer } from '@sim/context/SimHostContext';
import { useAplRotation } from '@sim/hooks/useAplRotation';
import { SimTabPane } from '@ui-kit/SimTabPane';

import { RotationTabBody } from './RotationTabBody';

const ROTATION_TYPE_ATTR: Record<number, string> = {
	[APLRotationType.TypeAuto]: 'auto',
	[APLRotationType.TypeSimple]: 'simple',
	[APLRotationType.TypeAPL]: 'apl',
};

export const RotationTabPane = () => {
	const player = usePlayer();
	const rotationType = useAplRotation(() => player.getRotationType());

	return (
		<SimTabPane id="rotation-tab" data-rotation-type={ROTATION_TYPE_ATTR[rotationType]}>
			<RotationTabBody rotationType={rotationType} />
		</SimTabPane>
	);
};
