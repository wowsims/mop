import i18n from '@i18n/config';
import type { Sim } from '@sim/sim';
import { subscribeSimField } from '@sim/state/subscriptions';
import { NumberPicker } from '@ui-kit/NumberPicker';

import { trackEvent } from '../tracking/analytics';

export interface IterationsPickerProps {
	sim: Sim;
}

export const IterationsPicker = ({ sim }: IterationsPickerProps) => (
	<NumberPicker
		modObject={sim}
		config={{
			id: 'simui-iterations',
			label: i18n.t('sidebar.iterations'),
			extraCssClasses: ['iterations-picker'],
			storeSubscribe: (sim: Sim) => subscribeSimField(sim, 'iterations'),
			getValue: (sim: Sim) => sim.getIterations(),
			setValue: (sim: Sim, newValue: number) => {
				trackEvent({
					action: 'settings',
					category: 'iterations',
					label: 'update',
					value: newValue,
				});
				sim.setIterations(newValue);
			},
		}}
	/>
);
