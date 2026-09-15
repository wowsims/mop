import { SimHostProvider } from '@sim/context/SimHostContext';
import type { CombatLog } from '@sim/proto/combat_log';
import { act, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { DrStickySlotContext } from '../DetailedResults/DrStickySlotContext';
import { LogRunner } from './LogRunner';

let result: SimResultData | null = null;
vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));

// Every row, so the assertions are about what the list selected rather than what it windowed. The
// wrapper carries `data-index`/`data-stripe` because that is what the real one stripes off.
vi.mock('@ui-kit/VirtualList', async importOriginal => ({
	...(await importOriginal<typeof import('@ui-kit/VirtualList')>()),
	VirtualList: ({
		count,
		testId,
		renderRow,
		getScrollElement,
		scrollMargin,
	}: {
		count: number;
		testId?: string;
		renderRow: (index: number) => unknown;
		getScrollElement: () => HTMLElement | Window | null;
		scrollMargin?: number;
	}) => (
		<div
			data-testid={testId ?? 'virtual-list'}
			data-scroller={(() => {
				const scroller = getScrollElement();
				return scroller === null ? 'null' : scroller instanceof HTMLElement ? scroller.className : 'window';
			})()}
			data-scroll-margin={scrollMargin}>
			{Array.from({ length: count }, (_unused, index) => (
				<div key={index} data-testid="virtual-list-row" data-index={index} data-stripe={index % 2 === 0 ? 'even' : 'odd'}>
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
const rows = (container: HTMLElement) =>
	[...container.querySelectorAll('[data-testid="virtual-list-row"] [data-testid="log-event"]')].map(row => row.textContent);

// The export dialog reads the host for its portal container.
const host = { rootElem: document.body } as never;
const Wrapper = ({ children }: { children: ReactNode }) => {
	const [slot, setSlot] = useState<HTMLDivElement | null>(null);
	return (
		<SimHostProvider host={host}>
			<div data-testid="dr-root">
				<div data-testid="dr-sticky-slot" ref={setSlot} />
			</div>
			<DrStickySlotContext.Provider value={slot}>{children}</DrStickySlotContext.Provider>
		</SimHostProvider>
	);
};

const mount = (active = true) => render(<LogRunner active={active} />, { wrapper: Wrapper });

const searchInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('[data-testid="log-search-input"]')!;

beforeEach(() => {
	result = null;
	vi.useRealTimers();
});

describe('LogRunner', () => {
	it('renders the sticky chrome, the list and the bar even before the first run', () => {
		const { container } = mount();

		expect(container.querySelector('[data-testid="log-runner-root"]')).not.toBeNull();
		expect(container.querySelector('[data-testid="log-runner-sticky"] > [data-testid="log-search"] > [data-testid="search-bar-root"]')).not.toBeNull();
		expect([...container.querySelectorAll('[data-testid="log-runner-header"] > div')].map(cell => cell.textContent)).toEqual([
			'results_tab.details.logs.time_column',
			'results_tab.details.logs.event_column',
		]);
		expect(container.querySelector('[data-testid="log-runner-scroll"] > [data-testid="log-runner-list"] > [data-testid="log-runner-logs"]')).not.toBeNull();
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
		const { container, rerender } = mount(false);
		expect(rows(container)).toEqual([]);

		rerender(<LogRunner active={true} />);

		expect(rows(container)).toHaveLength(2);
	});

	it('stripes from the absolute index, which is what survives the transform layout', () => {
		result = resultWith(LOGS);
		const { container } = mount();

		expect([...container.querySelectorAll('[data-testid="virtual-list-row"]')].map(row => (row as HTMLElement).dataset.stripe)).toEqual(['even', 'odd']);
	});

	it('narrows the list to the lines the search box matches', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		result = resultWith(LOGS);
		const { container } = mount();

		fireEvent.change(searchInput(container), { target: { value: 'Cleave' } });
		await act(async () => void vi.advanceTimersByTime(200));

		expect(rows(container)).toEqual(['[2.00] Warrior casts Cleave']);
	});

	// A tall blank pane reads as broken rather than as filtered. Scoped to a run that produced lines:
	// before the first one the pane is empty because there is nothing to show yet, not because the
	// search excluded everything.
	it('says why the list is empty when a search matches nothing, and only once a run has landed', async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const { container, rerender } = mount();
		expect(container.querySelector('[data-testid="log-runner-empty"]')).toBeNull();

		result = resultWith(LOGS);
		rerender(<LogRunner active />);
		fireEvent.change(searchInput(container), { target: { value: 'no such line' } });
		await act(async () => void vi.advanceTimersByTime(200));

		expect(rows(container)).toEqual([]);
		expect(container.querySelector('[data-testid="log-runner-scroll"] > [data-testid="log-runner-empty"]')!.textContent).toBe(
			'results_tab.details.logs.no_matches',
		);
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

	it('opens the exporter over the whole log rather than the filtered view', () => {
		result = resultWith(LOGS);
		const { container } = mount();

		fireEvent.click([...container.querySelectorAll<HTMLButtonElement>('[data-testid="log-fab-controls"] button')][0]);

		// Three lines, not the two the list shows: the search and the debug toggle are the list's alone.
		// The cast-completed line is gone from both — that filter is on `logs`.
		expect(document.querySelector<HTMLTextAreaElement>('[data-testid="exporter"] [data-testid="exporter-textarea"]')!.value.split('\n')).toHaveLength(3);
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
		const { container } = render(<LogRunner active />, { container: outer, wrapper: Wrapper });

		expect(container.querySelector('[data-testid="log-runner-logs"]')!.getAttribute('data-scroller')).toBe('sim-ui');
	});

	it('falls back to the window when nothing above the list scrolls', () => {
		result = resultWith(LOGS);
		const { container } = mount();

		expect(container.querySelector('[data-testid="log-runner-logs"]')!.getAttribute('data-scroller')).toBe('window');
	});

	it('gives both bar buttons an explicit type, so neither submits a form', () => {
		const { container } = mount();

		expect([...container.querySelectorAll('[data-testid="log-fab-controls"] button')].map(button => button.getAttribute('type'))).toEqual([
			'button',
			'button',
		]);
	});

	// The debounced search box fires `onChange('')` once on mount. Scrolling the page then would move
	// whichever tab is actually open, because this pane is `display: none` until its tab is picked.
	describe('scrolling back to the top', () => {
		const rootScrollIntoView = vi.fn();
		const listScrollIntoView = vi.fn();

		// happy-dom leaves every box at 0x0 and every `offsetParent` null, which is also what a closed
		// tab looks like — so an open one has to be described on the element itself.
		const placeList = (container: HTMLElement, offsetParent: HTMLElement | null, listTop = -500) => {
			const list = container.querySelector<HTMLElement>('[data-testid="log-runner-list"]')!;
			Object.defineProperty(list, 'offsetParent', { value: offsetParent, configurable: true });
			list.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: listTop, width: 0, height: 0 });
			list.scrollIntoView = listScrollIntoView;
			container.querySelector<HTMLElement>('[data-testid="dr-root"]')!.scrollIntoView = rootScrollIntoView;
		};

		const showPane = (container: HTMLElement) => placeList(container, document.body);
		const hidePane = (container: HTMLElement) => placeList(container, null);

		const backToTop = (container: HTMLElement) =>
			fireEvent.click([...container.querySelectorAll<HTMLButtonElement>('[data-testid="log-fab-controls"] button')][1]);

		beforeEach(() => {
			rootScrollIntoView.mockClear();
			listScrollIntoView.mockClear();
		});

		it('does not scroll while the pane is the closed tab', async () => {
			vi.useFakeTimers({ shouldAdvanceTime: true });
			result = resultWith(LOGS);
			const { container } = mount();
			hidePane(container);
			rootScrollIntoView.mockClear();

			fireEvent.change(searchInput(container), { target: { value: 'Cleave' } });
			await act(async () => void vi.advanceTimersByTime(200));
			backToTop(container);

			expect(rootScrollIntoView).not.toHaveBeenCalled();
			expect(listScrollIntoView).not.toHaveBeenCalled();
		});

		it('scrolls the whole detailed-results section to the top natively, not the list itself which the sticky toolbar would cover', () => {
			result = resultWith(LOGS);
			const { container } = mount();
			showPane(container);
			rootScrollIntoView.mockClear();

			backToTop(container);

			expect(rootScrollIntoView).toHaveBeenCalledWith({ block: 'start' });
			expect(listScrollIntoView).not.toHaveBeenCalled();
		});

		it('never scrolls down to the list when its first row is already below the sticky chrome', () => {
			result = resultWith(LOGS);
			const { container } = mount();
			placeList(container, document.body, 200);
			rootScrollIntoView.mockClear();

			backToTop(container);

			expect(rootScrollIntoView).not.toHaveBeenCalled();
			expect(listScrollIntoView).not.toHaveBeenCalled();
		});
	});
});
