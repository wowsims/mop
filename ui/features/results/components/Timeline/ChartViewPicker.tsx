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
	className?: string;
}

const OUTLINE_BASE = 'border-primary text-primary hover:bg-primary hover:border-primary hover:text-primary-foreground';

const PEER_INPUT_CLASSES: Record<ChartView, string> = {
	rotation: 'peer/rotation',
	dps: 'peer/dps',
};
const PEER_LABEL_CLASSES: Record<ChartView, string> = {
	rotation:
		'peer-checked/rotation:bg-primary peer-checked/rotation:border-primary peer-checked/rotation:text-primary-foreground peer-focus-visible/rotation:shadow-focus-theme',
	dps: 'peer-checked/dps:bg-primary peer-checked/dps:border-primary peer-checked/dps:text-primary-foreground peer-focus-visible/dps:shadow-focus-theme',
};

/** Rotation or the DPS/resources chart. The two are alternatives, and the rotation is the default. */
export const ChartViewPicker = ({ value, onChange, className }: ChartViewPickerProps) => (
	<ButtonGroup className={className} size="sm">
		{CHART_VIEWS.map(view => (
			<Fragment key={view}>
				<input
					type="radio"
					className={clsx(PEER_INPUT_CLASSES[view], 'pointer-events-none absolute [clip:rect(0,0,0,0)]')}
					name="timeline-chart-view"
					id={`timeline-chart-view-${view}`}
					value={view}
					autoComplete="off"
					checked={value === view}
					onChange={() => onChange(view)}
				/>
				<Button as="label" variant={null} size="sm" htmlFor={`timeline-chart-view-${view}`} className={clsx(OUTLINE_BASE, PEER_LABEL_CLASSES[view])}>
					{i18n.t(`results_tab.details.timeline.chart_types.${view}`)}
				</Button>
			</Fragment>
		))}
	</ButtonGroup>
);
