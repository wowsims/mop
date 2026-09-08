import { subscribePlayerField } from '@sim/state/subscriptions';
import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import i18n from '@i18n/config';
import { SimTab } from '@ui-kit/sim_tab';

import { IndividualSimUI } from '../individual_sim_ui';

const ROTATION_TYPE_CLASSES: Record<number, string> = {
	[APLRotationType.TypeAuto]: 'rotation-type-auto',
	[APLRotationType.TypeSimple]: 'rotation-type-simple',
	[APLRotationType.TypeAPL]: 'rotation-type-apl',
};

export class RotationTab extends SimTab {
	constructor(simUI: IndividualSimUI<any>) {
		super(simUI, { identifier: 'rotation-tab', title: i18n.t('rotation_tab.title') });

		// The three sub-tabs are all rendered; this class on the pane is what shows one of them, and
		// the pane belongs to the tab rather than to the React body portalled into it.
		const applyRotationClass = () => {
			this.rootElem.classList.remove(...Object.values(ROTATION_TYPE_CLASSES));
			const rotationClass = ROTATION_TYPE_CLASSES[simUI.player.getRotationType()];
			if (rotationClass) this.rootElem.classList.add(rotationClass);
		};

		applyRotationClass();
		this.addOnDisposeCallback(subscribePlayerField(simUI.player, 'rotation')(applyRotationClass));
	}

	protected buildTabContent() {}
}
