import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { IndividualSimHost } from '@sim/sim_host';
import { createSimStore } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions());
vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));

const { GemSummary } = await import('./GemSummary');

const gem = (id: number, name: string) => ({ id, name, quality: 4 });

const hostWith = (gems: Array<ReturnType<typeof gem>>, setGear = vi.fn()) => {
	const gear = { getAllGems: () => gems, withoutGems: () => 'stripped' };
	const player = {
		sim: { store: createSimStore() },
		getGear: () => gear,
		canDualWield2H: () => false,
		setGear,
	} as unknown as Player<any>;
	return fakeHost({ player });
};

const renderSummary = (host: IndividualSimHost<any>) =>
	render(
		<SimHostProvider host={host}>
			<GemSummary />
		</SimHostProvider>,
	);

describe('GemSummary', () => {
	it('renders its rows on the first paint, with no notification', () => {
		const { container } = renderSummary(hostWith([gem(1, 'Bold'), gem(1, 'Bold'), gem(2, 'Delicate')]));

		expect(container.querySelector('.summary-table-root')).not.toBeNull();
		const rows = [...container.querySelectorAll('.summary-table-row')].map(row => row.textContent);
		expect(rows).toEqual(['Bold2', 'Delicate1']);
	});

	it('renders nothing at all when there are no gems', () => {
		const { container } = renderSummary(hostWith([]));

		expect(container.querySelector('.summary-table-root')).toBeNull();
		expect(container.querySelector('.summary-table-reset-button')).toBeNull();
		expect(container.querySelector('.content-block-body')).toBeNull();
	});

	it('strips the gems from the gear when reset is clicked', () => {
		const setGear = vi.fn();
		const { container } = renderSummary(hostWith([gem(1, 'Bold')], setGear));

		container.querySelector<HTMLButtonElement>('.summary-table-reset-button')!.click();

		expect(setGear).toHaveBeenCalledWith('stripped');
	});
});
