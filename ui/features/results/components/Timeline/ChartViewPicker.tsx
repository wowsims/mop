import i18n from '@i18n/config';
import { Fragment } from 'react';

import type { ChartView } from './utils';
import { CHART_VIEWS } from './utils';

export interface ChartViewPickerProps {
	value: ChartView;
	onChange: (next: ChartView) => void;
}

/** Rotation or the DPS/resources chart. The two are alternatives, and the rotation is the default. */
export const ChartViewPicker = ({ value, onChange }: ChartViewPickerProps) => (
	<div className="timeline-chart-picker btn-group" role="group">
		{CHART_VIEWS.map(view => (
			<Fragment key={view}>
				<input
					type="radio"
					className={`btn-check ${view}-option`}
					name="timeline-chart-view"
					id={`timeline-chart-view-${view}`}
					value={view}
					autoComplete="off"
					checked={value === view}
					onChange={() => onChange(view)}
				/>
				<label className={`btn btn-sm btn-outline-primary ${view}-option`} htmlFor={`timeline-chart-view-${view}`}>
					{i18n.t(`results_tab.details.timeline.chart_types.${view}`)}
				</label>
			</Fragment>
		))}
	</div>
);
