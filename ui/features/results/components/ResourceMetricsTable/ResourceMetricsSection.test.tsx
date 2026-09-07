import type { ResourceMetrics } from '@sim/proto_utils/sim_result';
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
	it('builds the title and the whole table shell before any result, with the container hidden', () => {
		const { container } = section(null);

		const wrapper = container.querySelector('.resource-metrics-table-container')!;
		expect(wrapper.className).toBe('resource-metrics-table-container hide');
		expect(wrapper.querySelector('.resource-metrics-table-title')?.textContent).toBe('Rage');
		expect(wrapper.querySelectorAll('.resource-metrics-table-root')).toHaveLength(1);
		expect(wrapper.querySelectorAll('thead th')).toHaveLength(6);
		expect(wrapper.querySelectorAll('tbody tr')).toHaveLength(0);
	});

	it('keeps the container hidden when a result produced no rows', () => {
		const { container } = section(resultDataWith([]));
		expect(container.querySelector('.resource-metrics-table-container')?.classList.contains('hide')).toBe(true);
	});

	it('shows the container once its table has rows, sorted by gain descending', () => {
		const { container } = section(resultDataWith([resource('Bloodthirst', 10), resource('Whirlwind', 30)]));

		expect(container.querySelector('.resource-metrics-table-container')?.classList.contains('hide')).toBe(false);
		expect([...container.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent)).toEqual(['Whirlwind', 'Bloodthirst']);
	});
});
