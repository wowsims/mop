import { ref } from 'tsx-vanilla';

import i18n from '../../../../i18n/config';
import { CombatLog, formattedTimestamp, isCastCompleted, rawWithoutTimestamp } from '../../../proto_utils/combat_log';
import { SimUI } from '../../../sim_ui';
import { TypedEvent } from '../../../typed_event.js';
import { LogExporter } from '../../individual_sim_ui/exporters/detailed_log_exporter';
import { BooleanPicker } from '../../pickers/boolean_picker.js';
import { VirtualList } from '../../virtual_scroll/virtual_list';
import { ResultComponent, ResultComponentConfig, SimResultData } from '../result_component.js';
import { LogLineElem } from './components/log_line';
import { LogIndex, SuggestionSource } from './search/indexes';
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
const EMPTY_SUGGESTIONS: SuggestionSource = { spells: [], units: [], schools: [], spellIcons: new Map() };

export class LogView extends ResultComponent {
	private readonly virtualList: VirtualList;
	private readonly searchBar: LogSearchBar;
	readonly showDebugChangeEmitter = new TypedEvent<void>('Show Debug');
	private showDebug = false;
	private ui: {
		search: HTMLDivElement;
		actions: HTMLDivElement;
		buttonToTop: HTMLButtonElement;
		exportLog: HTMLButtonElement;
		scrollContainer: HTMLDivElement;
		list: HTMLDivElement;
		contentContainer: HTMLDivElement;
	};

	private cacheKey: string | null = null;
	// Widest content the list has had to hold, in px. See setListWidth.
	private listWidth = 0;
	private logs: Array<CombatLog> = [];
	private logIndex: LogIndex | null = null;
	private visibleIndexes: Array<number> = [];
	// The results filter's selected target, as the number the log prints, or null for all.
	private targetNumber: number | null = null;

	constructor(config: ResultComponentConfig, simUi: SimUI) {
		config.rootCssClass = 'log-runner-root';
		super(config);

		const searchRef = ref<HTMLDivElement>();
		const actionsRef = ref<HTMLDivElement>();
		const buttonToTopRef = ref<HTMLButtonElement>();
		const exportLogRef = ref<HTMLButtonElement>();
		const scrollContainerRef = ref<HTMLDivElement>();
		const listRef = ref<HTMLDivElement>();
		const contentContainerRef = ref<HTMLDivElement>();

		const logExporter = new LogExporter(simUi.rootElem, simUi, () => this.getCombinedText());

		this.rootElem.appendChild(
			<>
				<div ref={actionsRef} className="log-runner-actions">
					<div ref={searchRef} className="log-search"></div>
					<button ref={exportLogRef} className="btn btn-primary order-last log-runner-scroll-to-top-btn me-2">
						{i18n.t('results_tab.details.logs.export_button')}
					</button>
					<button ref={buttonToTopRef} className="btn btn-primary order-last log-runner-scroll-to-top-btn">
						{i18n.t('results_tab.details.logs.top_button')}
					</button>
				</div>
				<div ref={scrollContainerRef} className="log-runner-scroll">
					<div ref={listRef} className="log-runner-list">
						<div className="log-runner-header">
							<div>{i18n.t('results_tab.details.logs.time_column')}</div>
							<div>{i18n.t('results_tab.details.logs.event_column')}</div>
						</div>
						<div ref={contentContainerRef} className="log-runner-logs"></div>
					</div>
				</div>
			</>,
		);

		this.ui = {
			search: searchRef.value!,
			actions: actionsRef.value!,
			buttonToTop: buttonToTopRef.value!,
			exportLog: exportLogRef.value!,
			scrollContainer: scrollContainerRef.value!,
			list: listRef.value!,
			contentContainer: contentContainerRef.value!,
		};

		this.searchBar = new LogSearchBar(this.ui.search, { suggestions: () => this.logIndex?.suggestions() ?? EMPTY_SUGGESTIONS });
		this.searchBar.changeEmitter.on(() => this.refreshVisible());

		this.ui.buttonToTop?.addEventListener('click', () => {
			this.virtualList.scrollToTop();
		});

		this.ui.exportLog?.addEventListener('click', () => {
			logExporter.open();
		});

		new BooleanPicker<LogView>(this.ui.actions, this, {
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
			scrollElem: this.ui.scrollContainer,
			contentElem: this.ui.contentContainer,
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
		this.visibleIndexes = this.logIndex ? this.logIndex.filter(this.searchBar.clauses, this.showDebug, this.targetNumber) : [];
		this.virtualList.scrollToTop();
	}

	onSimResult(resultData: SimResultData): void {
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
				<div className="log-event">{LogLineElem(log, false)}</div>
			</div>
		) as HTMLDivElement;
	}

	private getCombinedText(): string {
		return this.logs.map(log => `${formattedTimestamp(log)};${rawWithoutTimestamp(log.raw)}`).join('\n');
	}
}
