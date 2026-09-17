import i18n from '@i18n/config';

export interface ReplaySeekButtonProps {
	/** Seconds to jump, negative to rewind. */
	delta: number;
	glyph: string;
	onSeekBy: (delta: number) => void;
}

export const ReplaySeekButton = ({ delta, glyph, onSeekBy }: ReplaySeekButtonProps) => {
	const label = delta < 0 ? i18n.t('combat_replay.seek_back', { time: -delta }) : i18n.t('combat_replay.seek_fwd', { time: delta });

	return (
		<button type="button" data-testid="cr-ctrl-btn" className="ui-combat-replay-ctrl-btn" title={label} aria-label={label} onClick={() => onSeekBy(delta)}>
			<span aria-hidden="true">{glyph}</span>
		</button>
	);
};
