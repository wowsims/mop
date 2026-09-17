import i18n from '@i18n/config';
import { Button } from '@ui-kit/Button';
import { ButtonGroup } from '@ui-kit/ButtonGroup';

export interface ChartToolbarProps {
	onReset: () => void;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onPanLeft: () => void;
	onPanRight: () => void;
}

export const ChartToolbar = ({ onReset, onZoomIn, onZoomOut, onPanLeft, onPanRight }: ChartToolbarProps) => {
	const buttons: Array<{ key: string; icon: string; run: () => void }> = [
		{ key: 'reset', icon: 'fa-arrows-rotate', run: onReset },
		{ key: 'zoom_out', icon: 'fa-magnifying-glass-minus', run: onZoomOut },
		{ key: 'zoom_in', icon: 'fa-magnifying-glass-plus', run: onZoomIn },
		{ key: 'pan_left', icon: 'fa-chevron-left', run: onPanLeft },
		{ key: 'pan_right', icon: 'fa-chevron-right', run: onPanRight },
	];

	return (
		<ButtonGroup data-testid="timeline-chart-toolbar" className="ml-auto w-auto shrink-0 self-start" size="sm">
			{buttons.map(button => {
				const label = i18n.t(`results_tab.details.timeline.chart_options.${button.key}`);
				return (
					<Button key={button.key} size="sm" variant="outline-primary" title={label} aria-label={label} onClick={button.run}>
						<i className={`fas ${button.icon}`} aria-hidden="true" />
					</Button>
				);
			})}
		</ButtonGroup>
	);
};
