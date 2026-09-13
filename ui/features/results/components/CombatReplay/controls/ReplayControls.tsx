import i18n from '@i18n/config';
import clsx from 'clsx';

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
	<div className="cr-controls">
		<div className="cr-ctrl-row">
			{REWIND_STEPS.map(step => (
				<ReplaySeekButton key={step.delta} delta={step.delta} glyph={step.glyph} onSeekBy={clock.seekBy} />
			))}
			<button
				type="button"
				className="cr-play-btn cr-ctrl-btn"
				title={i18n.t('combat_replay.play_pause')}
				onClick={clock.playing ? clock.pause : clock.play}>
				<i className={clock.playing ? 'fas fa-pause' : 'fas fa-play'} aria-hidden="true" />
			</button>
			{FORWARD_STEPS.map(step => (
				<ReplaySeekButton key={step.delta} delta={step.delta} glyph={step.glyph} onSeekBy={clock.seekBy} />
			))}
			<div className="cr-speed-btns">
				{RATES.map(rate => (
					<button key={rate} type="button" className={clsx('cr-speed-btn', clock.rate === rate && 'active')} onClick={() => clock.setRate(rate)}>
						{rate}x
					</button>
				))}
			</div>
			<ReplayTimeDisplay duration={clock.duration} />
		</div>
		<div className="cr-scrub-row">
			<ReplayScrubber duration={clock.duration} onScrubStart={clock.pause} onSeek={clock.seekTo} />
		</div>
	</div>
);
