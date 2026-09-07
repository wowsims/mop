import type { AuraMetrics } from '@domain/proto_utils/sim_result';
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SimResultData } from '../../model/result_data';
import { AuraMetricsTable } from './AuraMetricsTable';

let result: SimResultData | null = null;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('../MetricsTable/MetricsActionCell', () => ({
	MetricsActionCell: ({ name, useBuffAura }: { name: string; useBuffAura?: boolean }) => <span data-buff-aura={String(!!useBuffAura)}>{name}</span>,
}));

const aura = (name: string, uptimePercent: number, isPet = false) =>
	({
		name,
		uptimePercent,
		averageProcs: 1,
		ppm: 1,
		unit: { isPet, petActionId: null },
		actionId: { toStringIgnoringTag: () => name },
	}) as unknown as AuraMetrics;

const playerResult = (auras: Array<AuraMetrics>, petAuras: Array<AuraMetrics> = []) =>
	({
		filter: {},
		result: { getRaidIndexedPlayers: () => [{ auras, pets: [{ auras: petAuras }] }] },
	}) as unknown as SimResultData;

const debuffResult = (auras: Array<AuraMetrics>) =>
	({
		filter: {},
		result: { getDebuffMetrics: () => auras },
	}) as unknown as SimResultData;

const rowNames = (container: HTMLElement) => [...container.querySelectorAll<HTMLTableRowElement>('tbody tr')].map(row => row.cells[0].textContent);

describe('AuraMetricsTable', () => {
	beforeEach(() => {
		result = null;
	});

	it('builds the four-column shell before any result, under the root the flag picks', () => {
		const buffs = render(<AuraMetricsTable useDebuffs={false} />);
		expect(buffs.container.querySelector('div')?.className).toBe('buff-metrics-root');
		expect(buffs.container.querySelectorAll('thead th')).toHaveLength(4);
		expect(buffs.container.querySelectorAll('tbody tr')).toHaveLength(0);

		const debuffs = render(<AuraMetricsTable useDebuffs={true} />);
		expect(debuffs.container.querySelector('div')?.className).toBe('debuff-metrics-root');
		expect(debuffs.container.querySelectorAll('thead th')).toHaveLength(4);
	});

	it('opens sorted by uptime descending', () => {
		result = playerResult([aura('Recklessness', 12), aura('Bloodbath', 40)]);
		const { container } = render(<AuraMetricsTable useDebuffs={false} />);
		expect(rowNames(container)).toEqual(['Bloodbath', 'Recklessness']);
	});

	// Vanilla applies its pet filter to the pet groups too, so they always empty. Reproduced on purpose.
	it('drops every pet aura from the buffs table, the player list and the pet groups alike', () => {
		result = playerResult([aura('Recklessness', 12), aura('Pet Only', 90, true)], [aura('Frenzy', 80, true)]);
		const { container } = render(<AuraMetricsTable useDebuffs={false} />);

		expect(rowNames(container)).toEqual(['Recklessness']);
		expect(container.querySelectorAll('.parent-metric')).toHaveLength(0);
	});

	it('reads the debuff list rather than the player when the flag is set', () => {
		result = debuffResult([aura('Weakened Blows', 55)]);
		const { container } = render(<AuraMetricsTable useDebuffs={true} />);
		expect(rowNames(container)).toEqual(['Weakened Blows']);
	});

	it('asks for the buff aura on the wowhead tooltip of every name cell', () => {
		result = playerResult([aura('Recklessness', 12)]);
		const { container } = render(<AuraMetricsTable useDebuffs={false} />);
		expect(container.querySelector('tbody [data-buff-aura]')?.getAttribute('data-buff-aura')).toBe('true');
	});
});
