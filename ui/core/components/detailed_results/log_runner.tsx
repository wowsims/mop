// @ts-expect-error
import debounce from 'lodash/debounce';
import { ref } from 'tsx-vanilla';

import i18n from '../../../i18n/config';
import { SimLog } from '../../proto_utils/logs_parser';
import { SimUI } from '../../sim_ui';
import { TypedEvent } from '../../typed_event.js';
import { LogExporter } from '../individual_sim_ui/exporters/detailed_log_exporter';
import { BooleanPicker } from '../pickers/boolean_picker.js';
import { VirtualList } from '../virtual_scroll/virtual_list';
import { ResultComponent, ResultComponentConfig, SimResultData } from './result_component.js';

const DEBUG_MARKER = '[DEBUG]';

// One entry per displayable log line. `searchText` is the raw log line plus the resolved
// ability name, lowercased. The raw line names abilities by id ("{SpellID: 55090}"), so the
// name has to be appended for "scourge strike" to match; building the corpus out of rendered
// markup instead, as this used to, also made "span", "icon" and "http" match every row.
type LogEntry = {
	log: SimLog;
	searchText: string;
	isDebug: boolean;
};

export class LogRunner extends ResultComponent {
	private readonly virtualList: VirtualList;
	readonly showDebugChangeEmitter = new TypedEvent<void>('Show Debug');
	private showDebug = false;
	private ui: {
		search: HTMLInputElement;
		actions: HTMLDivElement;
		buttonToTop: HTMLButtonElement;
		exportLog: HTMLButtonElement;
		scrollContainer: HTMLDivElement;
		contentContainer: HTMLDivElement;
	};

	// Logs are held as data, not as DOM. Rows are built when they scroll into view.
	private cacheKey: string | null = null;
	private entries: Array<LogEntry> = [];
	// Indexes into `entries` that pass the current search, in order. `allIndexes` and
	// `nonDebugIndexes` are the two results an empty query produces, so the common case
	// assigns a reference instead of rebuilding half a million integers per keystroke.
	private visibleIndexes: Array<number> = [];
	private allIndexes: Array<number> = [];
	private nonDebugIndexes: Array<number> = [];

	constructor(config: ResultComponentConfig, simUi: SimUI) {
		config.rootCssClass = 'log-runner-root';
		super(config);

		const searchRef = ref<HTMLInputElement>();
		const actionsRef = ref<HTMLDivElement>();
		const buttonToTopRef = ref<HTMLButtonElement>();
		const exportLogRef = ref<HTMLButtonElement>();
		const scrollContainerRef = ref<HTMLDivElement>();
		const contentContainerRef = ref<HTMLDivElement>();

		const logExporter = new LogExporter(simUi.rootElem, simUi, () => this.getCombinedText());

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
					<div className="log-runner-list">
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
			changedEvent: () => this.showDebugChangeEmitter,
			getValue: () => this.showDebug,
			setValue: (eventID, _logRunner, newValue) => {
				this.showDebug = newValue;
				this.showDebugChangeEmitter.emit(eventID);
			},
		});

		this.virtualList = new VirtualList({
			scrollElem: this.ui.scrollContainer,
			contentElem: this.ui.contentContainer,
			dataSource: {
				count: () => this.visibleIndexes.length,
				renderRow: position => this.renderRow(this.entries[this.visibleIndexes[position]].log),
			},
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
				let matchesAll = true;
				for (const keyword of keywords) {
					if (!entry.searchText.includes(keyword)) {
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
	}

	// `entries` and the index lists are one state transition; they are rebuilt together and
	// searchLogs() is always what follows, via onSimResult.
	private rebuildEntries(resultData: SimResultData) {
		const cacheKey = resultData.result.request.requestId;
		if (this.cacheKey === cacheKey) return;

		this.cacheKey = cacheKey;
		this.entries = resultData.result.logs
			// The explicit predicate keeps SimLog: negating a `this is X` guard otherwise
			// narrows the element type to never.
			.filter((log): log is SimLog => !log.isCastCompleted())
			.map(log => ({
				log,
				searchText: `${log.raw} ${log.actionId?.name ?? ''}`.toLowerCase(),
				isDebug: log.raw.includes(DEBUG_MARKER),
			}));
		this.allIndexes = this.entries.map((_, i) => i);
		this.nonDebugIndexes = this.allIndexes.filter(i => !this.entries[i].isDebug);
	}

	private renderRow(log: SimLog) {
		return (
			<div className="log-runner-row">
				<div className="log-timestamp">{log.formattedTimestamp()}</div>
				<div className="log-event">{log.toHTML(false)}</div>
			</div>
		) as HTMLDivElement;
	}

	// Built from the log objects. This used to scrape textContent out of the cached row
	// elements, so it threw if the export button was pressed before a sim had run.
	private getCombinedText(): string {
		return this.visibleIndexes
			.map(index => {
				const { log } = this.entries[index];
				return `${log.formattedTimestamp()};${log.raw}`;
			})
			.join('\n');
	}
}
