import i18n from '@i18n/config';

export interface ReplaySeekButtonProps {
	/** Seconds to jump, negative to rewind. */
	delta: number;
	glyph: string;
	onSeekBy: (delta: number) => void;
}

export const ReplaySeekButton = ({ delta, glyph, onSeekBy }: ReplaySeekButtonProps) => (
	<button
		type="button"
		className="cr-ctrl-btn"
		title={delta < 0 ? i18n.t('combat_replay.seek_back', { time: -delta }) : i18n.t('combat_replay.seek_fwd', { time: delta })}
		onClick={() => onSeekBy(delta)}>
		{glyph}
	</button>
);
