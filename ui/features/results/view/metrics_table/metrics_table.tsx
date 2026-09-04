import { CacheHandler } from '@domain/cache_handler';
import { ActionId } from '@domain/proto_utils/action_id';
import { setActionIdBackgroundAndHref, setActionIdWowheadDataset } from '@domain/proto_utils/action_id/dom';
import { ActionMetrics, AuraMetrics, ResourceMetrics, UnitMetrics } from '@domain/proto_utils/sim_result';
import { Emitter } from '@domain/state/events';
import i18n from '@i18n/config';
import tippy from 'tippy.js';
import { ref } from 'tsx-vanilla';

import { ResultComponent, ResultComponentConfig, SimResultData } from '../result_component';
import { TableSorter } from './table_sorter';

export enum ColumnSortType {
	None,
	Ascending,
	Descending,
}

export interface MetricsColumnConfig<T> {
	name: string;
	tooltip?: string;
	headerCellClass?: string;
	columnClass?: string;
	sort?: ColumnSortType;

	getValue?: (metric: T, isChildRow?: boolean) => number;

	// Either getDisplayString or fillCell must be specified.
	getDisplayString?: (metric: T, isChildRow?: boolean) => string;
	fillCell?: (metric: T, cellElem: HTMLElement, rowElem: HTMLElement, isChildRow?: boolean) => void;
}

const cachedMetricsTableIcon = new CacheHandler<HTMLAnchorElement>();

export abstract class MetricsTable<T extends ActionMetrics | AuraMetrics | UnitMetrics | ResourceMetrics> extends ResultComponent {
	private readonly columnConfigs: Array<MetricsColumnConfig<T>>;

	protected readonly tableElem: HTMLElement;
	protected readonly bodyElem: HTMLTableSectionElement;
	private readonly sorter: TableSorter;

	readonly onUpdate = new Emitter<void>();

	constructor(config: ResultComponentConfig, columnConfigs: Array<MetricsColumnConfig<T>>) {
		super(config);
		this.columnConfigs = columnConfigs;

		this.rootElem.appendChild(
			<table className="metrics-table tablesorter">
				<thead className="metrics-table-header">
					<tr className="metrics-table-header-row"></tr>
				</thead>
				<tbody className="metrics-table-body"></tbody>
			</table>,
		);

		this.tableElem = this.rootElem.querySelector<HTMLTableElement>('.metrics-table')!;
		this.bodyElem = this.rootElem.querySelector<HTMLTableSectionElement>('.metrics-table-body')!;

		const headerRowElem = this.rootElem.querySelector<HTMLTableRowElement>('.metrics-table-header-row')!;
		this.columnConfigs.forEach(columnConfig => {
			const headerCell = document.createElement('th');
			const tooltipContent = columnConfig.tooltip;
			headerCell.classList.add('metrics-table-header-cell');
			if (columnConfig.columnClass) {
				headerCell.classList.add(...columnConfig.columnClass.split(' '));
			}
			if (columnConfig.headerCellClass) {
				headerCell.classList.add(...columnConfig.headerCellClass.split(' '));
			}
			headerCell.appendChild(<span>{columnConfig.name}</span>);
			if (tooltipContent) {
				const tooltip = tippy(headerCell, {
					content: tooltipContent,
					ignoreAttributes: true,
				});
				this.addOnResetCallback(() => tooltip.destroy());
			}
			headerRowElem.appendChild(headerCell);
		});

		const sortCol = this.columnConfigs.findIndex(v => !!v.sort);

		this.sorter = new TableSorter({
			tableHead: headerRowElem,
			tableBody: this.bodyElem,
			dataSetKey: 'text',
			childRowClass: 'child-metric',
			defaultSortCol: sortCol !== -1 ? sortCol : 0,
			defaultSortDesc: sortCol !== -1 && this.columnConfigs[sortCol].sort == ColumnSortType.Descending,
		});
	}

	protected sortMetrics(metrics: Array<T>) {
		this.columnConfigs
			.filter(config => config.sort)
			.forEach(config => {
				if (!config.getValue) {
					throw new Error("Can' apply group sorting without getValue");
				}
				if (config.sort == ColumnSortType.Ascending) {
					metrics.sort((a, b) => config.getValue!(a) - config.getValue!(b));
				} else {
					metrics.sort((a, b) => config.getValue!(b) - config.getValue!(a));
				}
			});
	}

	private addRow(metric: T, isChildRow = false): HTMLElement {
		const rowElem = document.createElement('tr');
		this.bodyElem.appendChild(rowElem);

		this.columnConfigs.forEach(columnConfig => {
			const cellElem = document.createElement('td');
			if (columnConfig.getValue) {
				cellElem.dataset.text = String(columnConfig.getValue(metric, isChildRow));
			}
			if (columnConfig.columnClass) {
				cellElem.classList.add(columnConfig.columnClass);
			}
			if (columnConfig.fillCell) {
				columnConfig.fillCell(metric, cellElem, rowElem, isChildRow);
			} else if (columnConfig.getDisplayString) {
				cellElem.textContent = columnConfig.getDisplayString(metric, isChildRow);
			} else {
				throw new Error('Metrics column config does not provide content function: ' + columnConfig.name);
			}
			rowElem.appendChild(cellElem);
		});

		this.customizeRowElem(metric, rowElem, isChildRow);
		return rowElem;
	}

	private addGroup(metrics: Array<T>) {
		if (metrics.length == 0) {
			return;
		}

		if (metrics.length == 1 && this.shouldCollapse(metrics[0])) {
			this.addRow(metrics[0]);
			return;
		}

		// Manually sort because tablesorter doesn't let us apply sorting to child rows.
		this.sortMetrics(metrics);

		const mergedMetrics = this.mergeMetrics(metrics);
		const parentRow = this.addRow(mergedMetrics);
		const childRows = metrics.map(metric => this.addRow(metric, true));
		childRows.forEach(childRow => childRow.classList.add('child-metric'));

		let expand = true;
		parentRow.classList.add('parent-metric', 'expand');
		parentRow.addEventListener('click', () => {
			expand = !expand;
			if (expand) {
				childRows.forEach(row => row.classList.remove('hide'));
				parentRow.classList.add('expand');
			} else {
				childRows.forEach(row => row.classList.add('hide'));
				parentRow.classList.remove('expand');
			}
		});
	}

	onSimResult(resultData: SimResultData) {
		this.reset();
		const groupedMetrics = this.getGroupedMetrics(resultData).filter(group => group.length > 0);
		if (groupedMetrics.length) {
			this.rootElem.classList.remove('hide');
		} else {
			this.rootElem.classList.add('hide');
			this.onUpdate.emit();
			return;
		}

		groupedMetrics.forEach(group => this.addGroup(group));
		this.sorter.update();
		this.onUpdate.emit();
	}

	reset() {
		super.reset();
		this.bodyElem.replaceChildren();
	}

	// Whether a single-element group should have its parent row removed.
	// Override this to add custom behavior.
	protected shouldCollapse(_metric: T): boolean {
		return true;
	}

	// Override this to customize rowElem after it has been populated.
	protected customizeRowElem(_metric: T, _rowElem: HTMLElement, _isChildRow = false) {
		return;
	}

	// Override this to provide custom merge behavior.
	protected mergeMetrics(metrics: Array<T>): T {
		return metrics[0];
	}

	// Returns grouped metrics to display.
	abstract getGroupedMetrics(resultData: SimResultData): Array<Array<T>>;

	static nameCellConfig<T>(
		getData: (metric: T) => {
			name: string;
			actionId: ActionId;
			metricType: string;
		} & Pick<MetricsColumnConfig<T>, 'columnClass' | 'headerCellClass'>,
	): MetricsColumnConfig<T> {
		return {
			name: i18n.t('results_tab.details.columns.name'),
			fillCell: (metric: T, cellElem: HTMLElement, _rowElem: HTMLElement) => {
				const data = getData(metric);
				const actionIdAsString = data.actionId.toString();
				const iconElemRef = ref<HTMLAnchorElement>();
				const iconElem = cachedMetricsTableIcon.get(actionIdAsString);
				cellElem.appendChild(
					<div className="metrics-action">
						{iconElem?.cloneNode() || <a ref={iconElemRef} className="metrics-action-icon"></a>}
						<span className="metrics-action-name text-truncate">{data.name}</span>
						<span className="expand-toggle fa fa-caret-right"></span>
						<span className="expand-toggle fa fa-caret-down"></span>
					</div>,
				);
				if (!iconElem && iconElemRef.value) {
					setActionIdBackgroundAndHref(data.actionId, iconElemRef.value);
					setActionIdWowheadDataset(data.actionId, iconElemRef.value, {
						useBuffAura: data.metricType === 'AuraMetrics',
					});
					cachedMetricsTableIcon.set(actionIdAsString, iconElemRef.value);
				}
			},
		};
	}
}
