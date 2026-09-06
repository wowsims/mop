import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { CombatLog, formattedTimestamp, isCastCompleted, rawWithoutTimestamp } from '../../../proto_utils/combat_log';
import { SimUI } from '../../../sim_ui';
import { TypedEvent } from '../../../typed_event.js';
import { LogExporter } from '../../individual_sim_ui/exporters/detailed_log_exporter';
import { BooleanPicker } from '../../pickers/boolean_picker.js';
import { VirtualList } from '../../virtual_scroll/virtual_list';
import { ResultComponent, ResultComponentConfig, SimResultData } from '../result_component.js';
import { LogFloatingActionBar } from './components/log_floating_action_bar';
import { LogLineElem } from './components/log_line';
import { EMPTY_SUGGESTIONS, LogIndex, SortedInts } from './search/indexes';
import { LogSearchBar } from './search/search_bar';

const DEBUG_MARKER = '[DEBUG]';

// Timeline and CombatReplay narrow their unit list with this filter; the log has no unit rows, so
// the equivalent is to keep the lines naming that target. Null whenever it would be a no-op, which
// includes every single-target encounter.
function selectedTargetNumber(resultData: SimResultData): number | null {
	if (resultData.result.getTargets().length < 2) return null;
	const selected = resultData.result.getTargets(resultData.filter);
	return selected.length === 1 ? selected[0].index + 1 : null;
}

export class LogView extends ResultComponent {
	private readonly virtualList: VirtualList;
	private readonly searchBar: LogSearchBar;
	readonly showDebugChangeEmitter = new TypedEvent<void>('Show Debug');
	private showDebug = false;
	private ui: {
		sticky: HTMLDivElement;
		list: HTMLDivElement;
		contentContainer: HTMLDivElement;
	};

	// The page scrolls the log, the same as the timeline, so the search box and column header stick
	// under the results toolbar and the virtual list is told how much viewport all three cover.
	private toolbar: HTMLElement | null = null;
	private stickyTop = 0;
	private readonly chromeObserver = new ResizeObserver(() => this.measureStickyTop());

	private cacheKey: string | null = null;
	// Widest content the list has had to hold, in px. See setListWidth.
	private listWidth = 0;
	private logs: Array<CombatLog> = [];
	private logIndex: LogIndex | null = null;
	private visibleIndexes: SortedInts = [];
	// The results filter's selected target, as the number the log prints, or null for all.
	private targetNumber: number | null = null;

	constructor(config: ResultComponentConfig, simUi: SimUI) {
		config.rootCssClass = 'log-runner-root';
		super(config);

		const stickyRef = ref<HTMLDivElement>();
		const searchRef = ref<HTMLDivElement>();
		const listRef = ref<HTMLDivElement>();
		const contentContainerRef = ref<HTMLDivElement>();
		const buttonToTopRef = ref<HTMLButtonElement>();
		const exportLogRef = ref<HTMLButtonElement>();

		const logExporter = new LogExporter(simUi.rootElem, simUi, () => this.getCombinedText());

		this.rootElem.appendChild(
			<>
				<div ref={stickyRef} className="log-runner-sticky">
					<div ref={searchRef} className="log-search"></div>
					<div className="log-runner-header">
						<div>{i18n.t('results_tab.details.logs.time_column')}</div>
						<div>{i18n.t('results_tab.details.logs.event_column')}</div>
					</div>
				</div>
				<div className="log-runner-scroll">
					<div ref={listRef} className="log-runner-list">
						<div ref={contentContainerRef} className="log-runner-logs"></div>
					</div>
				</div>
			</>,
		);

		this.ui = {
			sticky: stickyRef.value!,
			list: listRef.value!,
			contentContainer: contentContainerRef.value!,
		};

		const actionBar = this.addChild(
			new LogFloatingActionBar(this.rootElem, { suggestions: () => this.logIndex?.suggestions() ?? EMPTY_SUGGESTIONS }, searchRef.value!),
		);
		this.searchBar = actionBar.searchBar;
		this.searchBar.changeEmitter.on(() => this.refreshVisible());

		actionBar.actionsElem.appendChild(
			<>
				<button ref={exportLogRef} className="btn btn-primary">
					{i18n.t('results_tab.details.logs.export_button')}
				</button>
				<button ref={buttonToTopRef} className="btn btn-primary">
					{i18n.t('results_tab.details.logs.top_button')}
				</button>
			</>,
		);
		buttonToTopRef.value!.addEventListener('click', () => this.virtualList.scrollToTop());
		exportLogRef.value!.addEventListener('click', () => logExporter.open());

		this.chromeObserver.observe(this.ui.sticky);
		this.addOnDisposeCallback(() => this.chromeObserver.disconnect());

		new BooleanPicker<LogView>(actionBar.actionsElem, this, {
			id: 'log-runner-show-debug',
			extraCssClasses: ['show-debug-picker'],
			label: i18n.t('results_tab.details.logs.show_debug'),
			inline: true,
			reverse: true,
			changedEvent: () => this.showDebugChangeEmitter,
			getValue: () => this.showDebug,
			setValue: (eventID, _logView, newValue) => {
				this.showDebug = newValue;
				this.showDebugChangeEmitter.emit(eventID);
			},
		});

		this.virtualList = new VirtualList({
			contentElem: this.ui.contentContainer,
			topInset: () => this.stickyTop + this.ui.sticky.getBoundingClientRect().height,
			dataSource: {
				count: () => this.visibleIndexes.length,
				renderRow: position => this.renderRow(this.logs[this.visibleIndexes[position]]),
			},
			onRender: () => this.repairListWidth(),
		});
		this.addOnDisposeCallback(() => this.virtualList.dispose());

		this.showDebugChangeEmitter.on(() => this.refreshVisible());
	}

	private refreshVisible(): void {
		this.visibleIndexes = this.logIndex ? this.logIndex.filter(this.searchBar.groups, this.searchBar.keywords, this.showDebug, this.targetNumber) : [];
		this.virtualList.scrollToTop();
	}

	onSimResult(resultData: SimResultData): void {
		this.attachToolbar();
		this.rebuildEntries(resultData);
		this.targetNumber = selectedTargetNumber(resultData);
		this.refreshVisible();
		if (!this.listWidth) this.seedListWidth();
	}

	private rebuildEntries(resultData: SimResultData) {
		const cacheKey = resultData.result.request.requestId;
		if (this.cacheKey === cacheKey) return;

		this.cacheKey = cacheKey;
		this.listWidth = 0;
		this.ui.list.style.removeProperty('--log-runner-list-width');
		const logs = resultData.result.logs.filter(log => !isCastCompleted(log));
		this.logs = logs;
		this.logIndex = new LogIndex(logs, i => logs[i].raw.includes(DEBUG_MARKER));
		this.searchBar.refresh();
	}

	// Resolved here rather than in the constructor: the pane is built before it is in the document.
	private attachToolbar() {
		if (this.toolbar || !this.rootElem.isConnected) return;
		this.toolbar = this.rootElem.closest('.dr-root')?.querySelector<HTMLElement>('.dr-toolbar') ?? null;
		if (this.toolbar) this.chromeObserver.observe(this.toolbar);
		this.measureStickyTop();
	}

	// The measurement the rotation makes for its ruler (rotation_view.tsx measureStickyTop).
	private measureStickyTop() {
		const toolbar = this.toolbar;
		this.stickyTop = toolbar ? (parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.getBoundingClientRect().height : 0;
		this.rootElem.style.setProperty('--log-sticky-top', `${this.stickyTop}px`);
	}

	private seedListWidth() {
		if (!this.logs.length) return;

		let longest = this.logs[0];
		for (const log of this.logs) {
			if (log.raw.length > longest.raw.length) longest = log;
		}

		// Positioned out of flow, so it inherits the list's fonts without widening it.
		const measurer = (<div className="log-runner-measurer">{this.renderRow(longest)}</div>) as HTMLDivElement;
		this.ui.list.appendChild(measurer);
		const width = (measurer.firstElementChild as HTMLElement).offsetWidth;
		measurer.remove();
		this.setListWidth(width);
	}

	private repairListWidth() {
		if (!this.listWidth) return;
		const overflow = this.ui.contentContainer.scrollWidth - this.ui.contentContainer.clientWidth;
		if (overflow > 0) this.setListWidth(this.listWidth + overflow);
	}

	private setListWidth(width: number) {
		if (width <= this.listWidth) return;
		this.listWidth = width;
		this.ui.list.style.setProperty('--log-runner-list-width', `${Math.ceil(width)}px`);
	}

	private renderRow(log: CombatLog) {
		return (
			<div className="log-runner-row">
				<div className="log-timestamp">{formattedTimestamp(log)}</div>
				<div className="log-event">{LogLineElem(log)}</div>
			</div>
		) as HTMLDivElement;
	}

	private getCombinedText(): string {
		return this.logs.map(log => `${formattedTimestamp(log)};${rawWithoutTimestamp(log.raw)}`).join('\n');
	}
}
