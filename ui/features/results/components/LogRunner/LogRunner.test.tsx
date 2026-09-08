import type { CombatLog } from '@sim/proto/combat_log';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LogExporterFactory } from '../../model/log_exporter';
import type { SimResultData } from '../../model/result_data';
import { LogRunner } from './LogRunner';

let result: SimResultData | null = null;
vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));

// Every row, so the assertions are about what the list selected rather than what it windowed. The
// wrapper carries `data-index`/`data-stripe` because that is what the real one stripes off.
vi.mock('@ui-kit/VirtualList', () => ({
	VirtualList: ({
		count,
		className,
		renderRow,
		getScrollElement,
		scrollMargin,
	}: {
		count: number;
		className?: string;
		renderRow: (index: number) => unknown;
		getScrollElement: () => HTMLElement | Window | null;
		scrollMargin?: number;
	}) => (
		<div
			className={`virtual-list ${className ?? ''}`}
			data-scroller={(() => {
				const scroller = getScrollElement();
				return scroller === null ? 'null' : scroller instanceof HTMLElement ? scroller.className : 'window';
			})()}
			data-scroll-margin={scrollMargin}>
			{Array.from({ length: count }, (_unused, index) => (
				<div key={index} className="virtual-list-row" data-index={index} data-stripe={index % 2 === 0 ? 'even' : 'odd'}>
					{renderRow(index) as never}
				</div>
			))}
		</div>
	),
}));

vi.mock('./LogLine', () => ({ LogLine: ({ log }: { log: CombatLog }) => <span>{log.raw}</span> }));

const line = (extra: Record<string, unknown>): CombatLog =>
	({
		kind: 'plain',
		raw: '[1.00] a line',
		logIndex: 0,
		timestamp: 1,
		source: null,
		target: null,
		actionId: null,
		actionIdAsString: null,
		spellSchool: null,
		threat: 0,
		activeAuras: [],
		...extra,
	}) as unknown as CombatLog;

const resultWith = (logs: Array<CombatLog>, targets = 1): SimResultData =>
	({
		result: { logs, getTargets: () => Array.from({ length: targets }, (_unused, index) => ({ index })) },
		filter: {},
	}) as unknown as SimResultData;

const LOGS = [
	line({ raw: '[1.00] Warrior casts Mortal Strike', logIndex: 0 }),
	line({ raw: '[2.00] Warrior casts Cleave', logIndex: 1, timestamp: 2 }),
	line({ raw: '[3.00] [DEBUG] internal chatter', logIndex: 2, timestamp: 3 }),
	line({ kind: 'cast-completed', raw: '[4.00] Completed cast', logIndex: 3, timestamp: 4 }),
];

// Scoped to the list: the hidden width measurer renders a row of its own, and in a DOM that reports
// every box as 0x0 it never gets its answer and so never unmounts.
const rows = (container: HTMLElement) => [...container.querySelectorAll('.virtual-list-row .log-event')].map(row => row.textContent);

const mount = (active = true, makeLogExporter: LogExporterFactory = vi.fn(() => ({ open: vi.fn() }))) => ({
	makeLogExporter,
	...render(<LogRunner active={active} makeLogExporter={makeLogExporter} />),
});

const searchInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('.log-search-input')!;

beforeEach(() => {
	result = null;
	vi.useRealTimers();
});

describe('LogRunner', () => {
	it('renders the sticky chrome, the list and the bar even before the first run', () => {
		const { container } = mount();

		expect(container.querySelector('.log-runner-root')).not.toBeNull();
		expect(container.querySelector('.log-runner-sticky > .log-search > .search-bar-root')).not.toBeNull();
		expect([...container.querySelectorAll('.log-runner-header > div')].map(cell => cell.textContent)).toEqual([
			'results_tab.details.logs.time_column',
			'results_tab.details.logs.event_column',
		]);
		expect(container.querySelector('.log-runner-scroll > .log-runner-list > .virtual-list')!.className).toContain('log-runner-logs');
		expect(rows(container)).toEqual([]);
	});

	it('lists every non-debug line once a run lands, dropping the cast-completed noise', () => {
		result = resultWith(LOGS);
		const { container } = mount();

		expect(rows(container)).toEqual(['[1.00] Warrior casts Mortal Strike', '[2.00] Warrior casts Cleave']);
	});

	// What `deferUntilShown` bought: a run that arrives while the tab is closed costs nothing.
	it('indexes nothing while the tab is closed, and catches up when it opens', () => {
		result = resultWith(LOGS);
		const { container, rerender } = render(<LogRunner active={false} makeLogExporter={vi.fn(() => ({ open: vi.fn() }))} />);
		expect(rows(container)).toEqual([]);

		rerender(<LogRunner active={true} makeLogExporter={vi.fn(() => ({ open: vi.fn() }))} />);

		expect(rows(container)).toHaveLength(2);
	});

	it('stripes from the absolute index, which is what survives the transform layout', () => {
		result = resultWith(LOGS);
		const { container } = mount();

		expect([...container.querySelectorAll('.virtual-list-row')].map(row => (row as HTMLElement).dataset.stripe)).toEqual(['even', 'odd']);
	});

	it('narrows the list to the lines the search box matches', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		result = resultWith(LOGS);
		const { container } = mount();

		fireEvent.change(searchInput(container), { target: { value: 'Cleave' } });
		await act(async () => void vi.advanceTimersByTime(200));

		expect(rows(container)).toEqual(['[2.00] Warrior casts Cleave']);
	});

	it('keeps a quoted phrase whole when it filters', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		result = resultWith(LOGS);
		const { container } = mount();

		fireEvent.change(searchInput(container), { target: { value: '"casts Mortal"' } });
		await act(async () => void vi.advanceTimersByTime(200));

		expect(rows(container)).toEqual(['[1.00] Warrior casts Mortal Strike']);
	});

	it('hides the debug lines until the debug toggle is on', () => {
		result = resultWith(LOGS);
		const { container } = mount();
		expect(rows(container)).not.toContain('[3.00] [DEBUG] internal chatter');

		fireEvent.click(container.querySelector<HTMLInputElement>('#log-runner-show-debug')!);

		expect(rows(container)).toContain('[3.00] [DEBUG] internal chatter');
	});

	it('opens the exporter the host handed it, over the whole log rather than the filtered view', () => {
		const open = vi.fn();
		const getLogData: Array<() => string> = [];
		const makeLogExporter = vi.fn((read: () => string) => {
			getLogData.push(read);
			return { open };
		});
		result = resultWith(LOGS);
		const { container } = mount(true, makeLogExporter);

		fireEvent.click([...container.querySelectorAll<HTMLButtonElement>('.log-fab-controls .btn-primary')][0]);

		expect(open).toHaveBeenCalledTimes(1);
		// Three lines, not the two the list shows: the search and the debug toggle are the list's alone.
		// The cast-completed line is gone from both, as it was in vanilla — that filter is on `logs`.
		expect(getLogData[0]().split('\n')).toHaveLength(3);
	});

	// The list shares a scroller with the rest of the pane, and `.log-runner-scroll` is not it: that
	// element hides its vertical overflow and only carries the sideways overflow of a long line. The
	// walk has to skip it and keep going, which is exactly what `findScrollParent` does.
	it('hands the list the nearest scrolling ancestor, skipping the overflow-hidden one', () => {
		const outer = document.createElement('div');
		outer.className = 'sim-ui';
		outer.style.overflowY = 'auto';
		document.body.appendChild(outer);
		result = resultWith(LOGS);
		const { container } = render(<LogRunner active makeLogExporter={vi.fn(() => ({ open: vi.fn() }))} />, { container: outer });

		expect(container.querySelector('.virtual-list')!.getAttribute('data-scroller')).toBe('sim-ui');
	});

	it('falls back to the window when nothing above the list scrolls', () => {
		result = resultWith(LOGS);
		const { container } = mount();

		expect(container.querySelector('.virtual-list')!.getAttribute('data-scroller')).toBe('window');
	});

	it('gives both bar buttons an explicit type, so neither submits a form', () => {
		const { container } = mount();

		expect([...container.querySelectorAll('.log-fab-controls .btn-primary')].map(button => button.getAttribute('type'))).toEqual(['button', 'button']);
	});

	// The debounced search box fires `onChange('')` once on mount. Scrolling the page then would move
	// whichever tab is actually open, because this pane is `display: none` until its tab is picked.
	describe('scrolling back to the top', () => {
		const scrollBy = vi.fn();

		// happy-dom leaves every box at 0x0 and every `offsetParent` null, which is also what a closed
		// tab looks like — so an open one has to be described on the element itself.
		const placeList = (container: HTMLElement, top: number, offsetParent: HTMLElement | null) => {
			const list = container.querySelector<HTMLElement>('.log-runner-list')!;
			Object.defineProperty(list, 'offsetParent', { value: offsetParent, configurable: true });
			list.getBoundingClientRect = () => ({ top, height: 0, bottom: top }) as DOMRect;
		};

		const showPane = (container: HTMLElement, top: number) => placeList(container, top, document.body);
		// Scrolled well past the header, so only the closed-tab guard can be what stops the scroll.
		const hidePane = (container: HTMLElement) => placeList(container, -240, null);

		const backToTop = (container: HTMLElement) => fireEvent.click([...container.querySelectorAll<HTMLButtonElement>('.log-fab-controls .btn-primary')][1]);

		beforeEach(() => {
			scrollBy.mockClear();
			vi.stubGlobal('scrollBy', scrollBy);
		});

		it('does not scroll while the pane is the closed tab', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			result = resultWith(LOGS);
			const { container } = mount();
			hidePane(container);
			scrollBy.mockClear();

			fireEvent.change(searchInput(container), { target: { value: 'Cleave' } });
			await act(async () => void vi.advanceTimersByTime(200));
			backToTop(container);

			expect(scrollBy).not.toHaveBeenCalled();
		});

		it('pulls the list back under the sticky header when it has scrolled past it', () => {
			result = resultWith(LOGS);
			const { container } = mount();
			showPane(container, -240);
			scrollBy.mockClear();

			backToTop(container);

			expect(scrollBy).toHaveBeenCalledWith({ top: -240 });
		});

		it('leaves the page alone when the list is already below the header', () => {
			result = resultWith(LOGS);
			const { container } = mount();
			showPane(container, 120);
			scrollBy.mockClear();

			backToTop(container);

			expect(scrollBy).not.toHaveBeenCalled();
		});
	});
});
