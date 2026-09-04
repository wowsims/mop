import { SimLog } from '@domain/proto_utils/logs';
import { Emitter } from '@domain/state/events';
import i18n from '@i18n/config';
import { BooleanPicker } from '@ui-kit/pickers/boolean_picker';
import { VirtualList } from '@ui-kit/virtual_list';
// @ts-expect-error
import debounce from 'lodash/debounce';
import { ref } from 'tsx-vanilla';

import { renderLog } from './log_lines';
import { ResultComponent, ResultComponentConfig, SimResultData } from './result_component';

// The exporter modal lives in the import-export feature; results/ must not
// import another feature's view, so the host builds it and passes it down.
export type LogExporterFactory = (getLogData: () => string) => { open: () => void };

const DEBUG_MARKER = '[DEBUG]';

type LogEntry = {
	log: SimLog;
	searchText?: string;
	isDebug: boolean;
};

export class LogRunner extends ResultComponent {
	private readonly virtualList: VirtualList;
	readonly showDebugChangeEmitter = new Emitter<void>();
	private showDebug = false;
	private ui: {
		search: HTMLInputElement;
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
	private entries: Array<LogEntry> = [];
	private visibleIndexes: Array<number> = [];
	private allIndexes: Array<number> = [];
	private nonDebugIndexes: Array<number> = [];

	constructor(config: ResultComponentConfig, makeLogExporter: LogExporterFactory) {
		config.rootCssClass = 'log-runner-root';
		super(config);

		const searchRef = ref<HTMLInputElement>();
		const actionsRef = ref<HTMLDivElement>();
		const buttonToTopRef = ref<HTMLButtonElement>();
		const exportLogRef = ref<HTMLButtonElement>();
		const scrollContainerRef = ref<HTMLDivElement>();
		const listRef = ref<HTMLDivElement>();
		const contentContainerRef = ref<HTMLDivElement>();

		const logExporter = makeLogExporter(() => this.getCombinedText());

		this.rootElem.appendChild(
			<>
				<div ref={actionsRef} className="log-runner-actions">
					<input ref={searchRef} type="text" className="form-control log-search-input" placeholder={i18n.t('common.filter')} />
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

		// Use the 'input' event to trigger search as the user types
		const onSearchHandler = () => {
			this.searchLogs(this.ui.search.value);
		};
		this.ui.search?.addEventListener('input', debounce(onSearchHandler, 150));
		this.ui.buttonToTop?.addEventListener('click', () => {
			this.virtualList.scrollToTop();
		});

		this.ui.exportLog?.addEventListener('click', () => {
			logExporter.open();
		});

		new BooleanPicker<LogRunner>(this.ui.actions, this, {
			id: 'log-runner-show-debug',
			extraCssClasses: ['show-debug-picker'],
			label: i18n.t('results_tab.details.logs.show_debug'),
			inline: true,
			reverse: true,
			storeSubscribe: () => this.showDebugChangeEmitter.on,
			getValue: () => this.showDebug,
			setValue: (_logRunner, newValue) => {
				this.showDebug = newValue;
				this.showDebugChangeEmitter.emit();
			},
		});

		this.virtualList = new VirtualList({
			scrollElem: this.ui.scrollContainer,
			contentElem: this.ui.contentContainer,
			dataSource: {
				count: () => this.visibleIndexes.length,
				renderRow: position => this.renderRow(this.entries[this.visibleIndexes[position]].log),
			},
			onRender: () => this.repairListWidth(),
		});
		this.addOnDisposeCallback(() => this.virtualList.dispose());

		this.showDebugChangeEmitter.on(() => {
			onSearchHandler();
		});
	}

	searchLogs(searchQuery: string): void {
		// Regular expression to match quoted phrases or words
		const matchQuotesRegex = /"([^"]+)"|\S+/g;
		let match;
		const keywords: Array<string> = [];
		// Extract keywords and quoted phrases from the search query
		while ((match = matchQuotesRegex.exec(searchQuery))) {
			keywords.push(match[1] ? match[1].toLowerCase() : match[0].toLowerCase());
		}

		// Filtering produces indexes, not elements, so a keystroke never builds a row.
		if (keywords.length === 0) {
			this.visibleIndexes = this.showDebug ? this.allIndexes : this.nonDebugIndexes;
		} else {
			const matches: Array<number> = [];
			for (let i = 0; i < this.entries.length; i++) {
				const entry = this.entries[i];
				if (!this.showDebug && entry.isDebug) continue;
				const text = (entry.searchText ??= `${entry.log.formattedTimestamp()} ${entry.log.raw} ${entry.log.actionId?.name ?? ''}`.toLowerCase());
				let matchesAll = true;
				for (const keyword of keywords) {
					if (!text.includes(keyword)) {
						matchesAll = false;
						break;
					}
				}
				if (matchesAll) matches.push(i);
			}
			this.visibleIndexes = matches;
		}

		this.virtualList.scrollToTop();
	}

	onSimResult(resultData: SimResultData): void {
		this.rebuildEntries(resultData);
		this.searchLogs(this.ui.search.value);
		if (!this.listWidth) this.seedListWidth();
	}

	private rebuildEntries(resultData: SimResultData) {
		const cacheKey = resultData.result.request.requestId;
		if (this.cacheKey === cacheKey) return;

		this.cacheKey = cacheKey;
		this.listWidth = 0;
		this.ui.list.style.removeProperty('--log-runner-list-width');
		this.entries = resultData.result.logs
			.filter((log): log is SimLog => !log.isCastCompleted())
			.map(log => ({
				log,
				isDebug: log.raw.includes(DEBUG_MARKER),
			}));
		this.allIndexes = this.entries.map((_, i) => i);
		this.nonDebugIndexes = this.allIndexes.filter(i => !this.entries[i].isDebug);
	}

	private seedListWidth() {
		if (!this.entries.length) return;

		let longest = this.entries[0].log;
		for (const { log } of this.entries) {
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

	private renderRow(log: SimLog) {
		return (
			<div className="log-runner-row">
				<div className="log-timestamp">{log.formattedTimestamp()}</div>
				<div className="log-event">{renderLog(log, false)}</div>
			</div>
		) as HTMLDivElement;
	}

	private getCombinedText(): string {
		return this.entries.map(({ log }) => `${log.formattedTimestamp()};${log.rawWithoutTimestamp()}`).join('\n');
	}
}
