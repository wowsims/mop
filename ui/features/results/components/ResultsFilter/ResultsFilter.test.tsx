import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { ResultsFilter } from './ResultsFilter';
import { ALL_UNITS, hasTarget, simResultFilter } from './utils';

let resultData: SimResultData | null = null;
vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => resultData }));

const resultWith = (...targets: Array<{ index: number; iconUrl?: string; classColor?: string }>) =>
	({
		result: {
			getTargets: () => targets,
			getTargetWithEncounterIndex: (index: number) => targets.find(target => target.index === index) ?? null,
		},
		filter: {},
	}) as never as SimResultData;

const mount = (target: number, onTargetChange = vi.fn()) => render(<ResultsFilter target={target} onTargetChange={onTargetChange} />);

const picker = () => document.querySelector('.results-filter-root > .unit-picker-root') as HTMLElement;
const trigger = () => picker().querySelector('.dropdown-picker-button') as HTMLButtonElement;
const items = () => [...picker().querySelectorAll<HTMLElement>('.dropdown-picker-item')];
const open = () => act(() => void fireEvent.click(trigger()));

beforeEach(() => {
	resultData = null;
});

describe('ResultsFilter', () => {
	it('stays hidden until a run has produced targets', () => {
		mount(ALL_UNITS);

		expect(picker().className).toContain('d-none');
		expect(trigger().textContent).toBe('Unit');
	});

	it('shows all targets plus one option per target of the run, in encounter order', async () => {
		resultData = resultWith({ index: 0 }, { index: 1 }, { index: 2 });
		mount(ALL_UNITS);
		expect(picker().className).not.toContain('d-none');

		await open();
		expect(items().map(item => item.textContent)).toEqual([
			'results_tab.details.all_targets',
			'results_tab.details.target_number',
			'results_tab.details.target_number',
			'results_tab.details.target_number',
		]);
		expect(items()[0].getAttribute('aria-checked')).toBe('true');
	});

	it("takes each target option's icon and colour off the unit it stands for", async () => {
		resultData = resultWith({ index: 0, iconUrl: 'boss.jpg', classColor: 'warrior' });
		mount(ALL_UNITS);
		await open();

		expect(items()[1].querySelector('img.unit-picker-item-icon')!.getAttribute('src')).toBe('boss.jpg');
		expect(items()[1].className).toContain('text-warrior');
		// All Targets carries an empty icon url on purpose, so it draws nothing.
		expect(items()[0].querySelector('.unit-picker-item-icon')).toBeNull();
	});

	it('reports the encounter index of the chosen target, and ALL_UNITS for all targets', async () => {
		const onTargetChange = vi.fn();
		resultData = resultWith({ index: 0 }, { index: 1 });
		mount(ALL_UNITS, onTargetChange);

		await open();
		await act(() => void fireEvent.click(items()[2]));
		expect(onTargetChange).toHaveBeenCalledWith(1);

		await open();
		await act(() => void fireEvent.click(items()[0]));
		expect(onTargetChange).toHaveBeenLastCalledWith(ALL_UNITS);
	});

	it('shows the target the pane has selected', async () => {
		resultData = resultWith({ index: 0 }, { index: 1 });
		mount(1);
		await open();

		expect(items().map(item => item.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true']);
	});
});

describe('the filter the pane emits', () => {
	it('is a null target for all units and the index otherwise', () => {
		expect(simResultFilter(ALL_UNITS)).toEqual({ target: null });
		expect(simResultFilter(0)).toEqual({ target: 0 });
		expect(simResultFilter(3)).toEqual({ target: 3 });
	});

	it('knows a target the run no longer has', () => {
		const { result } = resultWith({ index: 0 }, { index: 1 });

		expect(hasTarget(result, ALL_UNITS)).toBe(true);
		expect(hasTarget(result, 1)).toBe(true);
		expect(hasTarget(result, 2)).toBe(false);
	});
});

describe('a unit reference the options do not hold', () => {
	it('leaves the trigger on the default label', async () => {
		resultData = resultWith({ index: 0 });
		mount(4);

		expect(trigger().textContent).toBe('Unit');
		await open();
		expect(items().every(item => item.getAttribute('aria-checked') === 'false')).toBe(true);
	});
});
