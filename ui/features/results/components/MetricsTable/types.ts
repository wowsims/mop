/** `MetricsColumnConfig`'s two class hooks. `columnClass` lands on the `<th>` and every `<td>`; `headerCellClass` only on the `<th>`. */
export interface MetricsColumnMeta {
	columnClass?: string;
	headerCellClass?: string;
}
