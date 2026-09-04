import i18n from '../../../../../../i18n/config';

export type RotationToolbarProps = {
	zoomOutRef: JSX.HTMLElementProps<'button'>['ref'];
	zoomInRef: JSX.HTMLElementProps<'button'>['ref'];
	fitRef: JSX.HTMLElementProps<'button'>['ref'];
	resetRef: JSX.HTMLElementProps<'button'>['ref'];
};

const ToolbarButton = ({ buttonRef, icon, label }: { buttonRef: JSX.HTMLElementProps<'button'>['ref']; icon: string; label: string }) =>
	(
		<button ref={buttonRef} type="button" className="rotation-zoom-button" attributes={{ 'aria-label': label }}>
			<i className={icon} />
		</button>
	) as HTMLButtonElement;

export const RotationToolbar = ({ zoomOutRef, zoomInRef, fitRef, resetRef }: RotationToolbarProps) =>
	(
		<div className="rotation-corner">
			<ToolbarButton buttonRef={zoomOutRef} icon="fas fa-magnifying-glass-minus" label={i18n.t('results_tab.details.timeline.chart_options.zoom_out')} />
			<ToolbarButton buttonRef={zoomInRef} icon="fas fa-magnifying-glass-plus" label={i18n.t('results_tab.details.timeline.chart_options.zoom_in')} />
			<ToolbarButton buttonRef={fitRef} icon="fas fa-expand" label={i18n.t('results_tab.details.timeline.chart_options.fit')} />
			<ToolbarButton buttonRef={resetRef} icon="fas fa-rotate-left" label={i18n.t('results_tab.details.timeline.chart_options.reset')} />
		</div>
	) as HTMLDivElement;
