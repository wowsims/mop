import i18n from '@i18n/config';
import { Tooltip, tooltipAnchorProps } from '@ui-kit/Tooltip';
import { forwardRef, useId } from 'react';

export interface RotationToolbarProps {
	onZoomOut: () => void;
	onZoomIn: () => void;
	onFit: () => void;
	onReset: () => void;
}

/**
 * The corner above the row labels. Exactly `--label-w` wide — the view measures it to find the
 * resolved clamp, which is the only reason it takes a ref — so the ruler beside it lines up with
 * every track.
 */
export const RotationToolbar = forwardRef<HTMLDivElement, RotationToolbarProps>(({ onZoomOut, onZoomIn, onFit, onReset }, ref) => {
	const tooltipId = useId();
	const buttons: Array<{ key: string; icon: string; run: () => void }> = [
		{ key: 'zoom_out', icon: 'fas fa-magnifying-glass-minus', run: onZoomOut },
		{ key: 'zoom_in', icon: 'fas fa-magnifying-glass-plus', run: onZoomIn },
		{ key: 'fit', icon: 'fas fa-expand', run: onFit },
		{ key: 'reset', icon: 'fas fa-rotate-left', run: onReset },
	];

	return (
		<div ref={ref} className="rotation-corner">
			{buttons.map(button => {
				const label = i18n.t(`results_tab.details.timeline.chart_options.${button.key}`);
				return (
					<button
						key={button.key}
						type="button"
						className="rotation-zoom-button"
						aria-label={label}
						onClick={button.run}
						{...tooltipAnchorProps(tooltipId, label)}>
						<i className={button.icon} />
					</button>
				);
			})}
			<Tooltip id={tooltipId} place="bottom" />
		</div>
	);
});
RotationToolbar.displayName = 'RotationToolbar';
