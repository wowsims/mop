import i18n from '../../../../../i18n/config';

export interface ChartToolbarActions {
	reset: () => void;
	zoomIn: () => void;
	zoomOut: () => void;
	panLeft: () => void;
	panRight: () => void;
}

export function chartToolbar(actions: ChartToolbarActions): HTMLElement {
	const items: Array<{ key: string; icon: string; run: () => void }> = [
		{ key: 'reset', icon: 'fa-arrows-rotate', run: actions.reset },
		{ key: 'zoom_out', icon: 'fa-magnifying-glass-minus', run: actions.zoomOut },
		{ key: 'zoom_in', icon: 'fa-magnifying-glass-plus', run: actions.zoomIn },
		{ key: 'pan_left', icon: 'fa-chevron-left', run: actions.panLeft },
		{ key: 'pan_right', icon: 'fa-chevron-right', run: actions.panRight },
	];

	return (
		<div className="timeline-chart-toolbar btn-group btn-group-sm" attributes={{ role: 'group' }}>
			{items.map(item => {
				const label = i18n.t(`results_tab.details.timeline.chart_options.${item.key}`);
				return (
					<button type="button" className="btn btn-sm btn-outline-primary" title={label} attributes={{ 'aria-label': label }} onclick={item.run}>
						<i className={`fas ${item.icon}`} attributes={{ 'aria-hidden': 'true' }} />
					</button>
				);
			})}
		</div>
	) as HTMLElement;
}
