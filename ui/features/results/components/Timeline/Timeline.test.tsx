import { fireEvent, render } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { Timeline } from './Timeline';

const state = vi.hoisted(() => ({
	result: null as SimResultData | null,
	models: [] as Array<unknown>,
	specs: [] as Array<unknown>,
	built: 0,
	charted: 0,
}));

vi.mock('@sim/context/SimHostContext', () => ({ useSimHost: () => ({ player: { secondaryResource: null } }) }));
vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => state.result }));
vi.mock('../../view/timeline/rotation/model', () => ({
	buildRotationModel: ({ player }: { player: { id: string } }) => {
		state.built++;
		return { id: player.id, duration: 10, rows: [], sections: [], byKey: new Map() };
	},
}));
vi.mock('../../view/timeline/chart/build', () => ({
	chartSpec: (player: { id: string }) => {
		state.charted++;
		return { id: player.id, datasets: [], scales: {}, annotations: null, duration: 10 };
	},
}));
vi.mock('./rotation/RotationView', () => ({
	RotationView: ({ model }: { model: unknown }) => {
		state.models.push(model);
		return <div className="rotation-pane" />;
	},
}));
vi.mock('./chart/TimelineChart', () => ({
	TimelineChart: ({ spec }: { spec: unknown }) => {
		state.specs.push(spec);
		return <div className="timeline-chart" />;
	},
}));

const resultFor = (requestId: string, playerId: string, filter: unknown = {}) =>
	({
		result: {
			request: { requestId },
			result: { firstIterationDuration: 10 },
			getRaidIndexedPlayers: () => [{ id: playerId }],
			getTargets: () => [{ index: 0 }],
		},
		filter,
	}) as unknown as SimResultData;

const emit = (next: SimResultData | null, rerender: () => void) => {
	state.result = next;
	act(rerender);
};

beforeEach(() => {
	state.result = null;
	state.models.length = 0;
	state.specs.length = 0;
	state.built = 0;
	state.charted = 0;
});

const mount = (active: boolean) => {
	const view = render(<Timeline active={active} />);
	return { ...view, again: (next = active) => view.rerender(<Timeline active={next} />) };
};

describe('Timeline', () => {
	it('holds a run that lands while the tab is closed, and draws it when the tab opens', () => {
		const view = mount(false);
		emit(resultFor('a', 'p1'), view.again);
		expect(state.models.at(-1)).toBeNull();

		act(() => view.again(true));
		expect(state.models.at(-1)).toMatchObject({ id: 'p1' });
	});

	it('builds the rotation once for two emits of the same run under the same filter', () => {
		const view = mount(true);
		emit(resultFor('a', 'p1'), view.again);
		expect(state.built).toBe(1);

		emit(resultFor('a', 'p2'), view.again);
		expect(state.built).toBe(1);
		expect(state.models.at(-1)).toMatchObject({ id: 'p1' });
	});

	it('rebuilds when the filter changes, because the rows are the filtered units', () => {
		const view = mount(true);
		emit(resultFor('a', 'p1', { unit: 0 }), view.again);
		emit(resultFor('a', 'p2', { unit: 1 }), view.again);
		expect(state.built).toBe(2);
		expect(state.models.at(-1)).toMatchObject({ id: 'p2' });
	});

	it('draws nothing for a cleared result, whose raid is empty', () => {
		state.result = { ...resultFor('a', 'p1'), result: { ...resultFor('a', 'p1').result, getRaidIndexedPlayers: () => [] } } as unknown as SimResultData;
		mount(true);
		expect(state.models.at(-1)).toBeNull();
		expect(state.built).toBe(0);
	});

	it('survives a model that cannot be built', () => {
		const logged = vi.spyOn(console, 'log').mockImplementation(() => {});
		state.result = {
			...resultFor('a', 'p1'),
			result: {
				...resultFor('a', 'p1').result,
				getTargets: () => {
					throw new Error('no targets');
				},
			},
		} as unknown as SimResultData;
		mount(true);
		expect(state.models.at(-1)).toBeNull();
		expect(logged).toHaveBeenCalled();
	});

	it('leaves the chart series unbuilt until the DPS view is picked, then keeps them', () => {
		const view = mount(true);
		emit(resultFor('a', 'p1'), view.again);
		expect(state.specs.at(-1)).toBeNull();
		expect(state.charted).toBe(0);

		act(() => {
			fireEvent.click(view.container.querySelector('#timeline-chart-view-dps')!);
		});
		expect(state.charted).toBe(1);
		expect(state.specs.at(-1)).toMatchObject({ id: 'p1' });

		act(() => {
			fireEvent.click(view.container.querySelector('#timeline-chart-view-rotation')!);
		});
		act(() => {
			fireEvent.click(view.container.querySelector('#timeline-chart-view-dps')!);
		});
		expect(state.charted).toBe(1);
	});

	it('hides the pane that is not showing rather than unmounting it', () => {
		const view = mount(true);
		expect(view.container.querySelector('.dps-resources-plot')!.className).toContain('hide');
		expect(view.container.querySelector('.rotation-plot')!.className).not.toContain('hide');

		act(() => {
			fireEvent.click(view.container.querySelector('#timeline-chart-view-dps')!);
		});
		expect(view.container.querySelector('.dps-resources-plot')!.className).not.toContain('hide');
		expect(view.container.querySelector('.rotation-plot')!.className).toContain('hide');
	});
});
