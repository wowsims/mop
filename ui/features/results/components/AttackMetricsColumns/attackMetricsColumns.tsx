import { formatToCompactNumber, formatToNumber, formatToPercent } from '@sim/format';
import type { ActionMetrics } from '@sim/proto_utils/sim_result';
import i18n from '@i18n/config';
import type { RefObject } from 'react';

import { createMetricsColumnHelper, MetricsActionCell, type MetricsColumnMeta } from '../MetricsTable';
import { MetricsTotalBar } from '../MetricsTotalBar';

const helper = createMetricsColumnHelper<ActionMetrics>();

/** The three fallback formats the attack tables share. A column that needs another one passes its own `cell`. */
export const attackFormat = {
	number: (value: number) => formatToNumber(value, { fallbackString: '-' }),
	compact: (value: number) => formatToCompactNumber(value, { fallbackString: '-' }),
	percent: (value: number) => formatToPercent(value, { fallbackString: '-' }),
};

export interface PrimaryMetricColumnConfig {
	id: string;
	header: string;
	/** The column's sort value, and the bar's compact readout. */
	total: (metric: ActionMetrics) => number;
	/** The bar's numerator, measured against `max`. */
	value: (metric: ActionMetrics) => number;
	percentage: (metric: ActionMetrics) => number | undefined | null;
	max: RefObject<number | null>;
	/** The darkened second bar — shielding, healing's only. */
	overlay?: (metric: ActionMetrics) => number;
	tooltipId: string;
}

export interface TicksColumnConfig {
	id: string;
	header: string;
	/** The main number. `tick` follows it in parentheses when both are non-zero, and stands in for it when it is zero. */
	value: (metric: ActionMetrics) => number;
	tick: (metric: ActionMetrics) => number;
	format: (value: number) => string;
	/** Sorts as 0 whatever the cell shows. */
	zeroWhen?: (metric: ActionMetrics) => boolean;
	/** Renders a dash instead of the numbers. Damage dashes a passive action's Avg Cast; dtps does not. */
	dashWhen?: (metric: ActionMetrics) => boolean;
	meta?: MetricsColumnMeta;
}

export interface RateColumnConfig {
	id: string;
	header: string;
	value: (metric: ActionMetrics) => number;
	tooltipId?: string;
}

/**
 * The column shapes the damage, damage-taken and healing tables share.
 *
 * Parameterises the **column set, its order and each column's bindings** — the caller writes its own
 * array and hands every builder the metric fields, the header key and the tooltip ids it wants. Fixes
 * only **how one named shape renders**: the Name cell's markup, the primary cell's bar and its two
 * class tokens, the `value (tick)` pair, and the rate column's `text-success` / `text-body`.
 *
 * The three consumers already disagree on order (damage puts Crit % before Miss %, dtps after it) and
 * healing shares four of its twelve columns, so a builder keyed on a table *kind* would have been
 * bypassed. A column shape none of these covers is written inline with `createMetricsColumnHelper` and
 * dropped into the same array — adding an entry, never forking the markup.
 */
export const attackMetricsColumns = {
	name: () =>
		helper.accessor(row => row.metric.name, {
			id: 'name',
			header: i18n.t('results_tab.details.columns.name'),
			cell: info => (
				<MetricsActionCell
					name={info.row.original.metric.name}
					actionId={info.row.original.metric.actionId}
					expandable={info.row.getCanExpand()}
					expanded={info.row.getIsExpanded()}
					onToggle={info.row.getToggleExpandedHandler()}
				/>
			),
		}),

	primary: ({ id, header, total, value, percentage, max, overlay, tooltipId }: PrimaryMetricColumnConfig) =>
		helper.accessor(row => total(row.metric), {
			id,
			header,
			meta: { columnClass: 'metrics-table-cell--primary-metric', headerCellClass: 'text-center', tooltipId },
			cell: info => {
				const metric = info.row.original.metric;
				return (
					<MetricsTotalBar
						spellSchool={metric.spellSchool}
						percentage={percentage(metric)}
						max={max.current}
						total={total(metric)}
						value={value(metric)}
						overlayValue={overlay?.(metric)}
					/>
				);
			},
		}),

	casts: (meta?: MetricsColumnMeta) =>
		helper.accessor(row => row.metric.casts, {
			id: 'casts',
			header: i18n.t('results_tab.details.columns.casts'),
			meta,
			cell: info => attackFormat.number(info.getValue()),
		}),

	withTicks: ({ id, header, value, tick, format, zeroWhen, dashWhen, meta }: TicksColumnConfig) =>
		helper.accessor(row => (zeroWhen?.(row.metric) ? 0 : value(row.metric) || tick(row.metric)), {
			id,
			header,
			meta,
			cell: info => {
				const metric = info.row.original.metric;
				if (dashWhen?.(metric)) return '-';
				const primary = value(metric);
				const ticks = tick(metric);
				return (
					<>
						{format(primary || ticks)}
						{!!primary && !!ticks && <> ({format(ticks)})</>}
					</>
				);
			},
		}),

	rate: ({ id, header, value, tooltipId }: RateColumnConfig) =>
		helper.accessor(row => value(row.metric), {
			id,
			header,
			meta: { columnClass: 'text-success', headerCellClass: 'text-body', tooltipId },
			cell: info => formatToNumber(info.getValue(), { minimumFractionDigits: 2, fallbackString: '-' }),
		}),
};
