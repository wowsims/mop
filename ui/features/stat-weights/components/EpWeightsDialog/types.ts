import type { StatsTableColumn } from '../../model/stats_table';

export type StatsType = 'ep' | 'weight';

/** A `StatsTableColumn` with the per-render facts the markup needs: a stable id, its position among the columns of its own type (which is its `epRatios` index) and its label tooltip with the reference stat already folded in. */
export interface EpColumn extends StatsTableColumn {
	id: string;
	ratioIndex?: number;
	onCopy: () => void;
}
