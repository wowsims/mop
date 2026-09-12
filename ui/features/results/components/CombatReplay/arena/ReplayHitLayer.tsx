import { useRef } from 'react';

import { useReplayFrame } from '../../../hooks/useReplayFrame';
import type { ReplayEnemy } from '../../../model/replay';
import { activeHits } from '../../../model/replay';
import type { HitNodeCache } from './hitLayer';
import { paintHitLayer } from './hitLayer';

export interface ReplayHitLayerProps {
	enemy: ReplayEnemy;
}

/** React owns the layer; what is inside it is a particle animation and stays imperative. */
export const ReplayHitLayer = ({ enemy }: ReplayHitLayerProps) => {
	const layer = useRef<HTMLDivElement>(null);
	const cache = useRef<HitNodeCache>(new Map()).current;

	useReplayFrame(time => {
		if (layer.current) paintHitLayer(layer.current, cache, activeHits(enemy, time), time);
	});

	return <div ref={layer} className="cr-hit-layer" />;
};
