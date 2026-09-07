import { SimHostProvider } from '@domain/context/SimHostContext';
import type { Player } from '@domain/player';
import type { IndividualSimHost } from '@domain/sim_host';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const noopSubscribe = () => () => {};
vi.mock('@domain/state/subscriptions', () => ({ subscribeAll: () => noopSubscribe, subscribePlayerField: () => noopSubscribe }));
vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: '', name: '', href: '', ready: true }) }));

const { GemSummary } = await import('./GemSummary');

const gem = (id: number, name: string) => ({ id, name, quality: 4 });

const hostWith = (gems: Array<ReturnType<typeof gem>>, setGear = vi.fn()) => {
	const gear = { getAllGems: () => gems, withoutGems: () => 'stripped' };
	const player = {
		getGear: () => gear,
		isBlacksmithing: () => false,
		canDualWield2H: () => false,
		setGear,
	} as unknown as Player<any>;
	return { player } as unknown as IndividualSimHost<any>;
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

		expect(container.querySelector('.summary-table-root')?.classList.contains('hide')).toBe(false);
		const rows = [...container.querySelectorAll('.summary-table-row')].map(row => row.textContent);
		expect(rows).toEqual(['Bold2', 'Delicate1']);
	});

	it('hides itself and builds no reset button when there are no gems', () => {
		const { container } = renderSummary(hostWith([]));

		expect(container.querySelector('.summary-table-root')?.classList.contains('hide')).toBe(true);
		expect(container.querySelector('.summary-table-reset-button')).toBeNull();
		expect(container.querySelector('.content-block-body')?.children).toHaveLength(0);
	});

	it('strips the gems from the gear when reset is clicked', () => {
		const setGear = vi.fn();
		const { container } = renderSummary(hostWith([gem(1, 'Bold')], setGear));

		container.querySelector<HTMLButtonElement>('.summary-table-reset-button')!.click();

		expect(setGear).toHaveBeenCalledWith('stripped');
	});
});
