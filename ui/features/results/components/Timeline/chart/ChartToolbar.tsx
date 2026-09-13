import i18n from '@i18n/config';

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
		<div className="timeline-chart-toolbar btn-group btn-group-sm" role="group">
			{buttons.map(button => {
				const label = i18n.t(`results_tab.details.timeline.chart_options.${button.key}`);
				return (
					<button key={button.key} type="button" className="btn btn-sm btn-outline-primary" title={label} aria-label={label} onClick={button.run}>
						<i className={`fas ${button.icon}`} aria-hidden="true" />
					</button>
				);
			})}
		</div>
	);
};
