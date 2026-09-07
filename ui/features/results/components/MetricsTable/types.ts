/** `MetricsColumnConfig`'s two class hooks. `columnClass` lands on the `<th>` and every `<td>`; `headerCellClass` only on the `<th>`. */
export interface MetricsColumnMeta {
	columnClass?: string;
	headerCellClass?: string;
	/** One `<Tooltip id>` serves the whole column: every `<td>` in it becomes an anchor carrying its row's id, so a table with seven tooltip columns mounts seven tooltips rather than one per cell. */
	tooltipId?: string;
	/** The `<th>`'s own tooltip — vanilla's `MetricsColumnConfig.tooltip`. Plain text, so it rides on the anchor as `data-tooltip-content`. */
	headerTooltipId?: string;
	headerTooltip?: string;
}
