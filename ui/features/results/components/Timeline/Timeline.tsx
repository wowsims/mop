import './Timeline.scss';

import i18n from '@i18n/config';
import { useSimHost } from '@sim/context/SimHostContext';
import type { UnitMetrics } from '@sim/proto/sim_result';
import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import { buildRotationModel } from '../../model/timeline/rotation';
import { chartSpec } from './chart/build';
import { TimelineChart } from './chart/TimelineChart';
import { ChartViewPicker } from './ChartViewPicker';
import { RotationView } from './rotation/RotationView';
import type { ChartView } from './utils';
import { resultKey } from './utils';

export interface TimelineProps {
	/** The timeline tab is open. While it is not, a finished run is held rather than drawn. */
	active: boolean;
}

export const Timeline = ({ active }: TimelineProps) => {
	const secondaryResource = useSimHost().player.secondaryResource;
	const live = useSimResult();
	const [shown, setShown] = useState<ReturnType<typeof useSimResult>>(null);
	const [view, setView] = useState<ChartView>('rotation');

	// Two emits carrying the same run under the same filter draw the same timeline, so the result the
	// view holds only changes when its key does — which is what keeps a re-emit from rebuilding the model.
	useEffect(() => {
		if (!active || !live) return;
		setShown(prev => (resultKey(prev) === resultKey(live) ? prev : live));
	}, [active, live]);

	// A cleared result still emits, with an empty raid.
	const player = useMemo(() => (shown ? (shown.result.getRaidIndexedPlayers(shown.filter)[0] ?? null) : null), [shown]);
	const duration = shown ? shown.result.result.firstIterationDuration || 1 : 1;

	// The unit walk is inside the guard, not beside it: a result the model cannot be built from
	// leaves the rotation empty rather than taking the whole Results tab down with it.
	const model = useMemo(() => {
		if (!shown || !player) return null;
		try {
			return buildRotationModel({ player, targets: shown.result.getTargets(shown.filter), duration, secondaryResource });
		} catch (e) {
			console.log('Failed to update rotation chart: ', e);
			return null;
		}
	}, [shown, player, duration, secondaryResource]);

	// The rotation is the default view and the two are alternatives, so the chart's series are built
	// only once someone has asked for them — and then kept, so switching back and forth is free.
	const chartVisible = view === 'dps';
	const [armed, setArmed] = useState<{ player: UnitMetrics; duration: number } | null>(null);
	useEffect(() => {
		if (!player) setArmed(null);
		else if (chartVisible) setArmed(prev => (prev?.player === player && prev.duration === duration ? prev : { player, duration }));
	}, [chartVisible, player, duration]);

	const spec = useMemo(() => (armed ? chartSpec(armed.player, armed.duration, secondaryResource) : null), [armed, secondaryResource]);

	return (
		<div className="timeline-root">
			<div className="timeline-disclaimer">
				<div className="timeline-disclaimer-text d-flex flex-column">
					<p>
						<i className="warning fa fa-exclamation-triangle fa-xl me-2" />
						{i18n.t('results_tab.details.timeline.disclaimer')}
					</p>
					<p>{i18n.t('results_tab.details.timeline.note')}</p>
				</div>
				<ChartViewPicker value={view} onChange={setView} />
			</div>
			<div className="timeline-plots-container">
				<div className={clsx('timeline-plot dps-resources-plot', !chartVisible && 'hide')}>
					<TimelineChart spec={spec} />
				</div>
				<div className={clsx('timeline-plot rotation-plot', chartVisible && 'hide')}>
					<div className="rotation-next">
						<RotationView model={model} />
					</div>
				</div>
			</div>
		</div>
	);
};
