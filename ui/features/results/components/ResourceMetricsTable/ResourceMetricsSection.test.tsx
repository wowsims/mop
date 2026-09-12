import type { ResourceMetrics } from '@sim/proto/sim_result';
import { ResourceType } from '@generated/proto/spell';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { createMetricsColumnHelper, type MetricsColumnDef } from '../MetricsTable';
import { ResourceMetricsSection } from './ResourceMetricsSection';

const helper = createMetricsColumnHelper<ResourceMetrics>();

const columns = helper.columns([
	helper.accessor(row => row.metric.name, { id: 'name', header: 'Name', cell: info => info.getValue() }),
	helper.accessor(row => row.metric.events, { id: 'casts', header: 'Casts', cell: info => info.getValue().toFixed(1) }),
	helper.accessor(row => row.metric.gain, { id: 'gain', header: 'Gain', cell: info => info.getValue().toFixed(1) }),
	helper.accessor(row => row.metric.gainPerSecond, { id: 'gain-per-second', header: 'Gain/s', cell: info => info.getValue().toFixed(1) }),
	helper.accessor(row => row.metric.avgGain, { id: 'avg-gain', header: 'Avg Gain', cell: info => info.getValue().toFixed(1) }),
	helper.accessor(row => row.metric.wastedGain, { id: 'wasted-gain', header: 'Wasted', cell: info => info.getValue().toFixed(1) }),
]) as Array<MetricsColumnDef<ResourceMetrics>>;

const resource = (name: string, gain: number) =>
	({
		name,
		gain,
		events: 1,
		gainPerSecond: gain,
		avgGain: gain,
		wastedGain: 0,
		actionId: { toStringIgnoringTag: () => name },
	}) as unknown as ResourceMetrics;

const resultDataWith = (resources: Array<ResourceMetrics>) =>
	({
		filter: {},
		result: { getRaidIndexedPlayers: () => [{ getResourceMetrics: () => resources }] },
	}) as unknown as SimResultData;

const section = (resultData: SimResultData | null) =>
	render(<ResourceMetricsSection resourceType={ResourceType.ResourceTypeRage} title="Rage" columns={columns} resultData={resultData} />);

describe('ResourceMetricsSection', () => {
	it('renders no container at all before any result', () => {
		const { container } = section(null);

		expect(container.querySelector('.resource-metrics-table-container')).toBeNull();
	});

	it('renders no container when a result produced no rows', () => {
		const { container } = section(resultDataWith([]));
		expect(container.querySelector('.resource-metrics-table-container')).toBeNull();
	});

	it('builds the title and the whole table shell once its table has rows, sorted by gain descending', () => {
		const { container } = section(resultDataWith([resource('Bloodthirst', 10), resource('Whirlwind', 30)]));

		const wrapper = container.querySelector('.resource-metrics-table-container')!;
		expect(wrapper.className).toBe('resource-metrics-table-container');
		expect(wrapper.querySelector('.resource-metrics-table-title')?.textContent).toBe('Rage');
		expect(wrapper.querySelectorAll('.resource-metrics-table-root')).toHaveLength(1);
		expect(wrapper.querySelectorAll('thead th')).toHaveLength(6);
		expect([...container.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual(['Whirlwind', 'Bloodthirst']);
	});
});
