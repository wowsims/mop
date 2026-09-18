import { Exporter } from '@features/import-export';
import i18n from '@i18n/config';
import type { CombatLog } from '@sim/proto/combat_log';
import { isCastCompleted } from '@sim/proto/combat_log';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import type { BooleanPickerConfig } from '@ui-kit/BooleanPicker/types';
import { SearchBar } from '@ui-kit/SearchBar';
import { ToolbarButton } from '@ui-kit/Toolbar';
import { findScrollParent } from '@ui-kit/utils/dom';
import { useScrollMargin, VirtualList } from '@ui-kit/VirtualList';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useSimResult } from '../../hooks/useSimResult';
import { EMPTY_SUGGESTIONS, LogIndex } from '../../model/log/search/indexes';
import type { SimResultData } from '../../model/result_data';
import { useDrStickySlot } from '../DetailedResults/DrStickySlotContext';
import { LogRow } from './LogRow';
import { LogToolbar } from './LogToolbar';
import type { IdentifiedSearchGroup } from './utils';
import { combinedLogText, DEBUG_MARKER, keywordsOf, selectedTargetNumber } from './utils';

const SEARCH_DEBOUNCE_MS = 150;

/** Until a real row has been measured. The sticky chrome is covered by the list's own overscan. */
const ESTIMATED_ROW_HEIGHT = 32;

type Measured = { for: object | null; width: number; rowHeight: number };

const UNMEASURED: Measured = { for: null, width: 0, rowHeight: ESTIMATED_ROW_HEIGHT };

const longestOf = (logs: ReadonlyArray<CombatLog>): CombatLog => logs.reduce((longest, log) => (log.raw.length > longest.raw.length ? log : longest));

export interface LogRunnerProps {
	/** The pane is open. A run that lands while it is closed is indexed the first time it opens. */
	active: boolean;
}

export const LogRunner = ({ active }: LogRunnerProps) => {
	const resultData = useSimResult();
	const stickySlot = useDrStickySlot();

	const [seen, setSeen] = useState<SimResultData | null>(null);
	const [searchText, setSearchText] = useState('');
	const [groups, setGroups] = useState<Array<IdentifiedSearchGroup>>([]);
	const [showDebug, setShowDebug] = useState(false);
	const [measured, setMeasured] = useState<Measured>(UNMEASURED);
	// `null` until the list is in the document. In this app it resolves to `.sim-ui`, the one element
	// above the pane with `overflow-y: auto`; `window` is the fallback for a page that scrolls itself.
	const [scroller, setScroller] = useState<HTMLElement | Window | null>(null);

	const listRef = useRef<HTMLDivElement>(null);

	const scrollMargin = useScrollMargin(listRef, scroller, stickySlot?.parentElement ?? null);

	useEffect(() => {
		if (active && resultData) setSeen(resultData);
	}, [active, resultData]);

	const result = seen?.result ?? null;

	// Keyed on the result rather than on `seen`, so picking a target — which re-emits the same run
	// under a new filter — does not trigger re-indexing.
	const logs = useMemo(() => (result ? result.logs.filter(log => !isCastCompleted(log)) : []), [result]);
	const logIndex = useMemo(() => (logs.length ? new LogIndex(logs, index => logs[index].raw.includes(DEBUG_MARKER)) : null), [logs]);
	const suggestions = logIndex?.suggestions() ?? EMPTY_SUGGESTIONS;

	const targetNumber = seen ? selectedTargetNumber(seen) : null;
	const keywords = useMemo(() => keywordsOf(searchText), [searchText]);
	const visibleIndexes = useMemo(
		() => (logIndex ? logIndex.filter(groups, keywords, showDebug, targetNumber) : []),
		[logIndex, groups, keywords, showDebug, targetNumber],
	);

	// The exporter dumps everything, filtered or not, so it reads the logs through a ref.
	const logsRef = useRef(logs);
	logsRef.current = logs;
	const [exportOpen, setExportOpen] = useState(false);
	const exportData = useCallback(() => combinedLogText(logsRef.current), []);

	useLayoutEffect(() => {
		const list = listRef.current;
		if (!list) return;
		// `findScrollParent` skips an `overflow: hidden` ancestor, which is what `.log-runner-scroll`
		// is on the vertical axis — it only carries the sideways overflow of a long line. What it
		// finds here is `.sim-ui`; `window` is the fallback for a page that scrolls itself.
		setScroller(findScrollParent(list) ?? window);
	}, []);

	const needsMeasure = logs.length > 0 && measured.for !== result;
	const listWidth = measured.for === result ? measured.width : 0;
	const rowHeight = measured.for === result ? measured.rowHeight : ESTIMATED_ROW_HEIGHT;

	// Positioned out of flow, so it inherits the list's fonts without widening it. Both numbers come
	// off the same row.
	//
	// `offsetHeight`, the integer, is used deliberately, not by oversight. The fractional box is the
	// more accurate number and was tried: it puts the two lists at different offsets for the same
	// scroll position, since one of them rounds and this is the list it has to line up with.
	const measureRow = useCallback(
		(element: HTMLDivElement | null) => {
			const row = element?.firstElementChild as HTMLElement | undefined;
			if (!row?.offsetWidth) return;
			setMeasured({ for: result, width: row.offsetWidth, rowHeight: row.offsetHeight || ESTIMATED_ROW_HEIGHT });
		},
		[result],
	);

	// A line never wraps, so a row wider than its own box means the list is too narrow. Reported per
	// row on mount, since `@tanstack/react-virtual` has no built-in width-repair hook.
	const growToFit = useCallback((width: number) => {
		setMeasured(current => (width > current.width ? { ...current, width } : current));
	}, []);

	const scrollListToTop = useCallback(() => {
		const list = listRef.current;
		if (!list || list.offsetParent === null) return;
		const chrome = stickySlot?.parentElement ?? stickySlot;
		const visibleTop = chrome ? chrome.getBoundingClientRect().bottom : 0;
		if (list.getBoundingClientRect().top >= visibleTop - 1) return;
		const target = stickySlot?.closest<HTMLElement>('[data-testid="dr-root"]') ?? list;
		target.scrollIntoView({ block: 'start' });
	}, [stickySlot]);

	useEffect(() => {
		if (seen) scrollListToTop();
	}, [seen, scrollListToTop]);

	const showDebugHolder = useRef(false);
	const showDebugConfig = useMemo<BooleanPickerConfig<{ current: boolean }>>(
		() => ({
			id: 'log-runner-show-debug',
			extraClassNames: ['w-auto', 'mb-0'],
			label: i18n.t('results_tab.details.logs.show_debug'),
			layout: 'inline',
			reverse: true,
			// No `storeSubscribe`: this is `InputConfig`'s UI-local toggle, re-read after its own write.
			getValue: holder => holder.current,
			setValue: (holder, next) => {
				holder.current = next;
				setShowDebug(next);
				scrollListToTop();
			},
		}),
		[scrollListToTop],
	);

	return (
		<div data-testid="log-runner-root" className="flex min-h-log-body-min-h flex-col">
			{active &&
				stickySlot &&
				createPortal(
					<div data-testid="log-runner-sticky" className="flex flex-col gap-2 pt-2">
						<div data-testid="log-search" className="w-full lg:max-w-[50%]">
							<SearchBar
								value={searchText}
								onChange={next => {
									setSearchText(next);
									scrollListToTop();
								}}
								placeholder={i18n.t('results_tab.details.logs.search_placeholder')}
								debounceMs={SEARCH_DEBOUNCE_MS}
								autoComplete="off"
								inputTestId="log-search-input"
							/>
						</div>
						<div data-testid="log-runner-header" className="ui-log-row border-b-0 font-bold">
							<div className="p-2 text-right">{i18n.t('results_tab.details.logs.time_column')}</div>
							<div className="p-2">{i18n.t('results_tab.details.logs.event_column')}</div>
						</div>
					</div>,
					stickySlot,
				)}
			<div data-testid="log-runner-scroll" className="relative shrink-0 grow basis-auto overflow-x-auto overflow-y-hidden">
				<div
					ref={listRef}
					data-testid="log-runner-list"
					className="w-(--log-runner-list-width,max-content) min-w-full"
					style={listWidth ? { ['--log-runner-list-width' as string]: `${Math.ceil(listWidth)}px` } : undefined}>
					<VirtualList
						testId="log-runner-logs"
						count={visibleIndexes.length}
						rowHeight={rowHeight}
						getScrollElement={() => scroller}
						scrollMargin={scrollMargin}
						renderRow={position => <LogRow log={logs[visibleIndexes[position]]} onWidth={growToFit} />}
					/>
					{needsMeasure && (
						<div ref={measureRow} className="pointer-events-none invisible absolute top-0 left-0 w-max">
							<LogRow log={longestOf(logs)} />
						</div>
					)}
				</div>
				{logs.length > 0 && visibleIndexes.length === 0 && (
					<div data-testid="log-runner-empty" className="px-2 py-6 text-muted">
						{i18n.t('results_tab.details.logs.no_matches')}
					</div>
				)}
			</div>
			<LogToolbar
				groups={groups}
				suggestions={suggestions}
				onChange={next => {
					setGroups(next);
					scrollListToTop();
				}}>
				<ToolbarButton className="whitespace-nowrap" onClick={() => setExportOpen(true)}>
					{i18n.t('results_tab.details.logs.export_button')}
				</ToolbarButton>
				<ToolbarButton className="whitespace-nowrap" onClick={scrollListToTop}>
					{i18n.t('results_tab.details.logs.top_button')}
				</ToolbarButton>
				<BooleanPicker modObject={showDebugHolder} config={showDebugConfig} />
			</LogToolbar>
			<Exporter
				open={exportOpen}
				onOpenChange={setExportOpen}
				title={i18n.t('results_tab.details.logs.export_button')}
				allowDownload
				downloadFileName="wowsims-log.csv"
				downloadMimeType="text/csv"
				getData={exportData}
			/>
		</div>
	);
};
