import './MetricsCombinedTooltip.scss';

import { formatToCompactNumber } from '@sim/utils/format';
import type { SpellSchool } from '@generated/proto/common';
import i18n from '@i18n/config';
import clsx from 'clsx';
import { Fragment } from 'react';

import { MetricsTotalBar } from '../MetricsTotalBar';

export interface MetricsCombinedTooltipEntry {
	name: string;
	value: number;
	percentage: number;
	average?: number;
}

export interface MetricsCombinedTooltipGroup {
	name?: string;
	className?: string;
	totalPercentage: number;
	spellSchool?: SpellSchool | null;
	data: Array<MetricsCombinedTooltipEntry>;
}

export interface MetricsCombinedTooltipProps {
	groups: Array<MetricsCombinedTooltipGroup>;
	/** Overrides for the Type / Count / Average headers, by position. */
	headerValues?: Array<string | undefined>;
	hasMetricBars?: boolean;
}

/** The tooltip *body* only — a nested breakdown table. It parameterises the rows and the bars; the anchor, the open/close and the veto belong to the column's one `<Tooltip>`, which is what keeps a 19-row table at seven tooltip instances instead of 133. */
export const MetricsCombinedTooltip = ({ groups, headerValues, hasMetricBars = true }: MetricsCombinedTooltipProps) => {
	const displayGroups = groups
		.filter(group => group.data.some(entry => entry.value))
		.map(group => ({ ...group, data: group.data.filter(entry => entry.value) }));
	const hasAverageColumn = displayGroups.some(group => group.data.some(entry => typeof entry.average === 'number'));

	return (
		<table className="metrics-table">
			<thead className="metrics-table-header">
				<tr className="metrics-table-header-row">
					<th className="metrics-table-header-cell">{headerValues?.[0] || i18n.t('results_tab.details.tooltip_table.type')}</th>
					<th className="metrics-table-header-cell">{headerValues?.[1] || i18n.t('results_tab.details.tooltip_table.count')}</th>
					{hasAverageColumn && (
						<th className="metrics-table-header-cell">{headerValues?.[2] || i18n.t('results_tab.details.tooltip_table.average')}</th>
					)}
				</tr>
			</thead>
			<tbody className="metrics-table-body">
				{displayGroups.map(({ name: groupName, className, data, spellSchool, totalPercentage }, groupIndex) => {
					const maxValue = Math.max(...data.map(entry => entry.value));
					const columnCount = data.some(entry => typeof entry.average === 'number') ? 3 : 2;
					return (
						<Fragment key={groupName ?? groupIndex}>
							{groupName && displayGroups.length > 1 && (
								<tr className={clsx('metrics-table-group-header', className)}>
									<th className="text-start fw-normal" colSpan={columnCount}>
										{groupName}
									</th>
								</tr>
							)}
							{[...data]
								.sort((a, b) => b.value - a.value)
								.map(({ name, value, percentage, average }) => (
									<tr className={clsx(className)} key={name}>
										<td>{name}</td>
										<td>
											{hasMetricBars ? (
												<MetricsTotalBar
													spellSchool={spellSchool}
													percentage={(percentage / totalPercentage) * 100}
													max={maxValue}
													total={value}
													value={value}
												/>
											) : (
												formatToCompactNumber(value)
											)}
										</td>
										{typeof average === 'number' && <td>{formatToCompactNumber(average)}</td>}
									</tr>
								))}
						</Fragment>
					);
				})}
			</tbody>
		</table>
	);
};
