import './CombatReplay.scss';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useReplayClock } from '../../hooks/useReplayClock';
import { useSimResult } from '../../hooks/useSimResult';
import { buildReplayModel } from '../../model/replay';
import type { SimResultData } from '../../model/result_data';
import { ReplayEmpty } from './ReplayEmpty';
import { ReplayScene } from './ReplayScene';

export interface CombatReplayProps {
	/** The replay tab is open. While it is not, a finished run is held rather than parsed — the vanilla `deferUntilShown`. */
	active: boolean;
}

export const CombatReplay = ({ active }: CombatReplayProps) => {
	const live = useSimResult();
	const [shown, setShown] = useState<SimResultData | null>(null);

	useEffect(() => {
		if (!active || !live) return;
		setShown(live);
	}, [active, live]);

	const model = useMemo(() => (shown ? buildReplayModel(shown.result, shown.filter) : null), [shown]);
	const clock = useReplayClock(model?.duration ?? 0);

	// Warmed rather than rendered: an icon first seen a minute in would otherwise pop in as it is cast.
	const warmed = useRef(new Set<string>()).current;
	useEffect(() => {
		model?.iconUrls.forEach(url => {
			if (warmed.has(url)) return;
			warmed.add(url);
			new Image().src = url;
		});
	}, [model, warmed]);

	// The vanilla stopped playback both when the tab was hidden and on every new result — and did it
	// before it built the scene. A layout effect for the same reason: a passive one runs after the
	// browser has painted, so a re-run part-way through a fight would flash the new scene at the old
	// playhead before resetting it.
	const { pause, seekTo } = clock;
	useLayoutEffect(() => {
		pause();
		seekTo(0);
	}, [active, model, pause, seekTo]);

	return <div className="combat-replay-root">{model ? <ReplayScene model={model} clock={clock} /> : <ReplayEmpty />}</div>;
};
