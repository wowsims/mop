import './LogRunner.scss';

import { Exporter } from '@features/import-export';
import i18n from '@i18n/config';
import type { CombatLog } from '@sim/proto/combat_log';
import { isCastCompleted } from '@sim/proto/combat_log';
import { BooleanPicker } from '@ui-kit/BooleanPicker';
import type { BooleanPickerConfig } from '@ui-kit/pickers/boolean_picker';
import { SearchBar } from '@ui-kit/SearchBar';
import { findScrollParent } from '@ui-kit/utils/dom';
import { VirtualList } from '@ui-kit/VirtualList';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { useSimResult } from '../../hooks/useSimResult';
import type { SimResultData } from '../../model/result_data';
import { EMPTY_SUGGESTIONS, LogIndex } from '../../view/log/search/indexes';
import { LogFloatingActionBar } from './LogFloatingActionBar';
import { LogRow } from './LogRow';
import type { IdentifiedSearchGroup } from './utils';
import { combinedLogText, DEBUG_MARKER, keywordsOf, selectedTargetNumber } from './utils';

const SEARCH_DEBOUNCE_MS = 150;

/** Until a real row has been measured. The sticky chrome is covered by the list's own overscan. */
const ESTIMATED_ROW_HEIGHT = 32;

type Measured = { for: object | null; width: number; rowHeight: number };

const UNMEASURED: Measured = { for: null, width: 0, rowHeight: ESTIMATED_ROW_HEIGHT };

const longestOf = (logs: ReadonlyArray<CombatLog>): CombatLog => logs.reduce((longest, log) => (log.raw.length > longest.raw.length ? log : longest));

export interface LogRunnerProps {
	/** The pane is open. A run that lands while it is closed is indexed the first time it opens, which is what vanilla's `deferUntilShown` bought. */
	active: boolean;
}

export const LogRunner = ({ active }: LogRunnerProps) => {
	const resultData = useSimResult();

	const [seen, setSeen] = useState<SimResultData | null>(null);
	const [searchText, setSearchText] = useState('');
	const [groups, setGroups] = useState<Array<IdentifiedSearchGroup>>([]);
	const [showDebug, setShowDebug] = useState(false);
	const [measured, setMeasured] = useState<Measured>(UNMEASURED);
	// `null` until the list is in the document. In this app it resolves to `.sim-ui`, the one element
	// above the pane with `overflow-y: auto`; `window` is the fallback for a page that scrolls itself.
	const [scroller, setScroller] = useState<HTMLElement | Window | null>(null);
	const [scrollMargin, setScrollMargin] = useState(0);

	const rootRef = useRef<HTMLDivElement>(null);
	const stickyRef = useRef<HTMLDivElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	// Both read from callbacks rather than from a render, so neither can be a piece of state.
	const stickyTopRef = useRef(0);
	const scrollerRef = useRef<HTMLElement | Window | null>(null);

	useEffect(() => {
		if (active && resultData) setSeen(resultData);
	}, [active, resultData]);

	const result = seen?.result ?? null;

	// Keyed on the result rather than on `seen`: picking a target re-emits the same run under a new
	// filter, and re-indexing it there is what vanilla's `requestId` cache existed to avoid.
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

	// Where the scroller's content starts, in viewport coordinates. Subtracting it from an element's
	// box gives that element's offset *down the scroll content*, which does not move as it scrolls.
	const contentTop = (scroller: HTMLElement | Window | null) =>
		scroller instanceof HTMLElement ? scroller.getBoundingClientRect().top - scroller.scrollTop : -window.scrollY;

	// The toolbar is resolved here rather than at mount: the pane is built before it is in the
	// document. Rendering from inside a ResizeObserver callback loops, so every measurement lands in
	// a frame of its own.
	const measureChrome = useCallback(() => {
		const list = listRef.current;
		const toolbar = rootRef.current?.closest('.dr-root')?.querySelector<HTMLElement>('.dr-toolbar') ?? null;
		const stickyTop = toolbar ? (parseFloat(getComputedStyle(toolbar).top) || 0) + toolbar.getBoundingClientRect().height : 0;
		stickyTopRef.current = stickyTop;
		rootRef.current?.style.setProperty('--log-sticky-top', `${stickyTop}px`);
		// Scroll-independent on purpose: this is remeasured whenever the chrome above resizes, and a
		// viewport-relative number would be whatever the scroll position happened to be at the time.
		if (list) setScrollMargin(list.getBoundingClientRect().top - contentTop(scrollerRef.current));
	}, []);

	useLayoutEffect(() => {
		const sticky = stickyRef.current;
		const list = listRef.current;
		if (!sticky || !list) return;

		// `findScrollParent` skips an `overflow: hidden` ancestor, which is what `.log-runner-scroll`
		// is on the vertical axis — it only carries the sideways overflow of a long line. What it
		// finds here is `.sim-ui`; `window` is the fallback for a page that scrolls itself.
		scrollerRef.current = findScrollParent(list) ?? window;
		setScroller(scrollerRef.current);

		let frame: number | null = null;
		const observer = new ResizeObserver(() => {
			if (frame !== null) return;
			frame = requestAnimationFrame(() => {
				frame = null;
				measureChrome();
			});
		});
		observer.observe(sticky);
		observer.observe(list);
		const toolbar = rootRef.current?.closest('.dr-root')?.querySelector<HTMLElement>('.dr-toolbar');
		if (toolbar) observer.observe(toolbar);
		measureChrome();

		return () => {
			observer.disconnect();
			if (frame !== null) cancelAnimationFrame(frame);
		};
	}, [measureChrome]);

	const needsMeasure = logs.length > 0 && measured.for !== result;
	const listWidth = measured.for === result ? measured.width : 0;
	const rowHeight = measured.for === result ? measured.rowHeight : ESTIMATED_ROW_HEIGHT;

	// Positioned out of flow, so it inherits the list's fonts without widening it. Both numbers come
	// off the same row: the vanilla list measured its own first row for the height.
	//
	// `offsetHeight`, the integer, as the vanilla list measured it — and deliberately, not by
	// oversight. The fractional box is the more accurate number and was tried: it puts the two lists
	// at different offsets for the same scroll position, because vanilla rounds and this is the list
	// it has to line up with. The half pixel it rounds away is slack vanilla carries in its spacers.
	const measureRow = useCallback(
		(element: HTMLDivElement | null) => {
			const row = element?.firstElementChild as HTMLElement | undefined;
			if (!row?.offsetWidth) return;
			setMeasured({ for: result, width: row.offsetWidth, rowHeight: row.offsetHeight || ESTIMATED_ROW_HEIGHT });
		},
		[result],
	);

	// A line never wraps, so a row wider than its own box means the list is too narrow. Reported per
	// row on mount, which is where `@tanstack/react-virtual` leaves the vanilla `onRender` hook.
	const growToFit = useCallback((width: number) => {
		setMeasured(current => (width > current.width ? { ...current, width } : current));
	}, []);

	// Brings the first row back under the sticky header, and only ever upwards: the list shares its
	// scroller with the whole pane, so scrolling down to it would push the chrome off screen.
	const scrollListToTop = useCallback(() => {
		const list = listRef.current;
		const scroller = scrollerRef.current;
		// `offsetParent` is null while the pane is the closed tab, and scrolling then moves whatever
		// tab is open instead.
		if (!list || !scroller || list.offsetParent === null) return;
		const visibleTop =
			(scroller instanceof HTMLElement ? scroller.getBoundingClientRect().top : 0) +
			stickyTopRef.current +
			(stickyRef.current?.getBoundingClientRect().height ?? 0);
		const top = list.getBoundingClientRect().top - visibleTop;
		if (top < 0) scroller.scrollBy({ top });
	}, []);

	useEffect(() => {
		if (seen) scrollListToTop();
	}, [seen, scrollListToTop]);

	const showDebugHolder = useRef(false);
	const showDebugConfig = useMemo<BooleanPickerConfig<{ current: boolean }>>(
		() => ({
			id: 'log-runner-show-debug',
			extraCssClasses: ['show-debug-picker'],
			label: i18n.t('results_tab.details.logs.show_debug'),
			inline: true,
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
		<div ref={rootRef} className="log-runner-root">
			<div ref={stickyRef} className="log-runner-sticky">
				<div className="log-search">
					<SearchBar
						value={searchText}
						onChange={next => {
							setSearchText(next);
							scrollListToTop();
						}}
						placeholder={i18n.t('results_tab.details.logs.search_placeholder')}
						debounceMs={SEARCH_DEBOUNCE_MS}
						autoComplete="off"
						className="log-search-input"
					/>
				</div>
				<div className="log-runner-header">
					<div>{i18n.t('results_tab.details.logs.time_column')}</div>
					<div>{i18n.t('results_tab.details.logs.event_column')}</div>
				</div>
			</div>
			<div className="log-runner-scroll">
				<div
					ref={listRef}
					className="log-runner-list"
					style={listWidth ? { ['--log-runner-list-width' as string]: `${Math.ceil(listWidth)}px` } : undefined}>
					<VirtualList
						className="log-runner-logs"
						count={visibleIndexes.length}
						rowHeight={rowHeight}
						getScrollElement={() => scroller}
						scrollMargin={scrollMargin}
						renderRow={position => <LogRow log={logs[visibleIndexes[position]]} onWidth={growToFit} />}
					/>
					{needsMeasure && (
						<div ref={measureRow} className="log-runner-measurer">
							<LogRow log={longestOf(logs)} />
						</div>
					)}
				</div>
				{logs.length > 0 && visibleIndexes.length === 0 && <div className="log-runner-empty">{i18n.t('results_tab.details.logs.no_matches')}</div>}
			</div>
			<LogFloatingActionBar
				groups={groups}
				suggestions={suggestions}
				onChange={next => {
					setGroups(next);
					scrollListToTop();
				}}>
				<button type="button" className="btn btn-primary" onClick={() => setExportOpen(true)}>
					{i18n.t('results_tab.details.logs.export_button')}
				</button>
				<button type="button" className="btn btn-primary" onClick={scrollListToTop}>
					{i18n.t('results_tab.details.logs.top_button')}
				</button>
				<BooleanPicker modObject={showDebugHolder} config={showDebugConfig} />
			</LogFloatingActionBar>
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
