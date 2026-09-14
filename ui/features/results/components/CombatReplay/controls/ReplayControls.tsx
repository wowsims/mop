import i18n from '@i18n/config';

import type { ReplayClock } from '../../../hooks/useReplayClock';
import { ReplayScrubber } from './ReplayScrubber';
import { ReplaySeekButton } from './ReplaySeekButton';
import { ReplayTimeDisplay } from './ReplayTimeDisplay';

export interface ReplayControlsProps {
	clock: ReplayClock;
}

const RATES = [1, 2, 3];

const REWIND_STEPS = [
	{ delta: -5, glyph: '⏪' },
	{ delta: -1, glyph: '◀' },
];

const FORWARD_STEPS = [
	{ delta: 1, glyph: '▶' },
	{ delta: 5, glyph: '⏩' },
];

export const ReplayControls = ({ clock }: ReplayControlsProps) => (
	<div className="relative z-1 shrink-0 px-3 pb-[8px] pt-1.5 border-t border-white-6 bg-transparent">
		<div className="flex min-h-[32px] flex-nowrap items-center gap-1.5 overflow-x-auto overflow-y-hidden scrollbar-thin">
			{REWIND_STEPS.map(step => (
				<ReplaySeekButton key={step.delta} delta={step.delta} glyph={step.glyph} onSeekBy={clock.seekBy} />
			))}
			<button
				type="button"
				data-testid="cr-play-btn"
				className="ui-combat-replay-ctrl-btn"
				title={i18n.t('combat_replay.play_pause')}
				onClick={clock.playing ? clock.pause : clock.play}>
				<i className={clock.playing ? 'fas fa-pause pointer-events-none' : 'fas fa-play pointer-events-none'} aria-hidden="true" />
			</button>
			{FORWARD_STEPS.map(step => (
				<ReplaySeekButton key={step.delta} delta={step.delta} glyph={step.glyph} onSeekBy={clock.seekBy} />
			))}
			<div className="flex gap-1">
				{RATES.map(rate => (
					<button
						key={rate}
						type="button"
						data-testid="cr-speed-btn"
						className="cursor-pointer rounded-sm border border-white-12 bg-white-5 px-[8px] py-0.75 text-[0.75rem] text-white-60 aria-pressed:border-white-50 aria-pressed:text-white"
						aria-pressed={clock.rate === rate}
						onClick={() => clock.setRate(rate)}>
						{rate}x
					</button>
				))}
			</div>
			<ReplayTimeDisplay duration={clock.duration} />
		</div>
		<div className="mt-1">
			<ReplayScrubber duration={clock.duration} onScrubStart={clock.pause} onSeek={clock.seekTo} />
		</div>
	</div>
);
