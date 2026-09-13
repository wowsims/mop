import { useFrameList } from '../../../hooks/useReplayFrame';
import type { ReplayAction } from '../../../model/replay';
import { tickerCasts, tickerOpacity } from '../../../model/replay';
import { castKey } from '../utils';
import { ReplayTickerIcon } from './ReplayTickerIcon';

export interface ReplayTickerProps {
	actions: ReadonlyArray<ReplayAction>;
}

/** The last few casts, newest on the right — the strip that runs above the arena. */
export const ReplayTicker = ({ actions }: ReplayTickerProps) => {
	const casts = useFrameList(actions, time => tickerCasts(actions, time), castKey);

	return (
		<div className="cr-ticker-track">
			{casts.map((cast, index) => (
				<ReplayTickerIcon key={castKey(cast)} action={cast} latest={index === casts.length - 1} opacity={tickerOpacity(index, casts.length)} />
			))}
		</div>
	);
};
