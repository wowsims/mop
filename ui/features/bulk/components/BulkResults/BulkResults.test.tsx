import type { TopGearResult } from '@sim/bulk/types';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import { patchBulkState, seedBulkSettings } from '@sim/settings/bulk_settings';
import { createSimStore } from '@sim/state/sim_store';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./BulkResultRow', () => ({
	BulkResultRow: ({ iterations }: { iterations: number }) => <div data-testid="row" data-iterations={iterations} />,
}));

const { BulkResults } = await import('./BulkResults');

const STORE_KEY = 9;
const RUN_ITERATIONS = 30000;

const result = (avg: number) => ({ gear: {}, dpsMetrics: { avg, stdev: 1 } }) as unknown as TopGearResult;

const mount = () => {
	const store = createSimStore();
	const player = { sim: { store, getIterations: () => 100 }, storeKey: STORE_KEY } as unknown as Player<any>;
	seedBulkSettings(player);
	const baseline = result(1000);
	patchBulkState(player, {
		started: true,
		results: { chains: [[result(1100)], [baseline]], originalGearResults: baseline, iterations: RUN_ITERATIONS },
	});
	const host = { player, sim: player.sim } as never;
	return render(
		<SimHostProvider host={host}>
			<BulkResults />
		</SimHostProvider>,
	);
};

describe('BulkResults', () => {
	it('gives every row the iteration count the run was scored with, not the sidebar value', () => {
		const { getAllByTestId } = mount();
		const rows = getAllByTestId('row');

		expect(rows).toHaveLength(2);
		expect(rows.map(row => row.getAttribute('data-iterations'))).toEqual([String(RUN_ITERATIONS), String(RUN_ITERATIONS)]);
	});
});
