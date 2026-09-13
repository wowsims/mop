import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { ButtonGroup } from '@ui-kit/ButtonGroup';
import clsx from 'clsx';
import { Fragment } from 'react';

import type { ChartView } from './utils';
import { CHART_VIEWS } from './utils';

export interface ChartViewPickerProps {
	value: ChartView;
	onChange: (next: ChartView) => void;
}

const FLAT_PRIMARY_OUTLINE_CLASSES =
	'border-primary text-primary hover:bg-primary hover:border-primary hover:text-primary-foreground peer-checked:bg-primary peer-checked:border-primary peer-checked:text-primary-foreground peer-focus-visible:shadow-focus-theme';

/** Rotation or the DPS/resources chart. The two are alternatives, and the rotation is the default. */
export const ChartViewPicker = ({ value, onChange }: ChartViewPickerProps) => (
	<ButtonGroup className="timeline-chart-picker" size="sm">
		{CHART_VIEWS.map(view => (
			<Fragment key={view}>
				<input
					type="radio"
					className={`peer sr-only ${view}-option`}
					name="timeline-chart-view"
					id={`timeline-chart-view-${view}`}
					value={view}
					autoComplete="off"
					checked={value === view}
					onChange={() => onChange(view)}
				/>
				<Button
					as="label"
					variant={null}
					size="sm"
					htmlFor={`timeline-chart-view-${view}`}
					className={clsx(FLAT_PRIMARY_OUTLINE_CLASSES, `${view}-option`)}>
					{i18n.t(`results_tab.details.timeline.chart_types.${view}`)}
				</Button>
			</Fragment>
		))}
	</ButtonGroup>
);
