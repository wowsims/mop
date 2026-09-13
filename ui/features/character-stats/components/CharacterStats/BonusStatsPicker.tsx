import type { Stat } from '@generated/proto/common';
import { usePlayer } from '@sim/context/SimHostContext';
import { usePlayerStore } from '@sim/hooks/usePlayerStore';
import type { Stats } from '@sim/proto/stats';
import { NumberPicker } from '@ui-kit/NumberPicker';
import type { NumberPickerConfig } from '@ui-kit/NumberPicker/types';
import { useMemo } from 'react';

export interface BonusStatsPickerProps {
	rootStat: Stat;
	label: string;
	onCommit: () => void;
}

export const BonusStatsPicker = ({ rootStat, label, onCommit }: BonusStatsPickerProps) => {
	const player = usePlayer();
	const bonusStats = usePlayerStore('bonusStats');

	const config = useMemo(
		(): NumberPickerConfig<Stats> => ({
			id: `character-bonus-stat-${rootStat}`,
			label,
			extraClassNames: ['mb-0'],
			getValue: stats => stats.getStat(rootStat),
			setValue: (stats, newValue) => {
				player.setBonusStats(stats.withStat(rootStat, newValue));
				onCommit();
			},
		}),
		[rootStat, label, player, onCommit],
	);

	return <NumberPicker modObject={bonusStats} config={config} />;
};
