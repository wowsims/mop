import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import { EnumPicker } from '@ui-kit/EnumPicker';

import { StatsType } from './types';

export interface EpWeightsOptionsProps {
	options: { statsType: number; showAllStats: boolean };
	onStatsTypeChange: (statsType: StatsType) => void;
	onShowAllStatsChange: (showAllStats: boolean) => void;
}

const STATS_TYPES: StatsType[] = [StatsType.Ep, StatsType.Weight];

/** Both values are UI-local and read back off `options`, which the dialog owns because this body unmounts on close: `useInput` re-reads its source synchronously on its own write, which is before a `useState` has committed. */
export const EpWeightsOptions = ({ options, onStatsTypeChange, onShowAllStatsChange }: EpWeightsOptionsProps) => (
	<div className="ep-weights-options row">
		<div className="col col-sm-3">
			<EnumPicker
				modObject={options}
				ariaLabel={i18n.t('sidebar.buttons.stat_weights.modal.stats_type')}
				config={{
					id: 'ep-type-select',
					extraClassNames: ['ep-type-select'],
					values: [
						{ name: i18n.t('sidebar.buttons.stat_weights.modal.ep'), value: 0 },
						{ name: i18n.t('sidebar.buttons.stat_weights.modal.weights'), value: 1 },
					],
					getValue: subject => subject.statsType,
					setValue: (subject, newValue) => {
						subject.statsType = newValue;
						onStatsTypeChange(STATS_TYPES[newValue]);
					},
				}}
			/>
		</div>
		<div className="show-all-stats-container col col-sm-3">
			<BooleanPicker
				modObject={options}
				config={{
					id: 'ep-show-all-stats',
					label: i18n.t('sidebar.buttons.stat_weights.modal.show_all_stats'),
					inline: true,
					getValue: subject => subject.showAllStats,
					setValue: (subject, newValue) => {
						subject.showAllStats = newValue;
						onShowAllStatsChange(newValue);
					},
				}}
			/>
		</div>
	</div>
);
