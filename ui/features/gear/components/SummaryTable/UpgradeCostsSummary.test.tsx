import { ItemQuality, Race } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { createSimStore, patchKeyed, PLAYER_FIELDS, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { UpgradeCostsSummary } = await import('./UpgradeCostsSummary');

const gladiatorCloak = {
	_item: { scalingOptions: {}, name: "Gladiator's Cloak of Prowess", nameDescription: '', phase: 4, quality: ItemQuality.ItemQualityEpic },
	upgrade: 0,
	getMaxUpgradeCount: () => 2,
} as unknown as EquippedItem;

const STORE_KEY = 0;

const renderSummary = (race: Race) => {
	const gear = { asArray: () => [gladiatorCloak] };
	const store = createSimStore();
	seedKeyed(store, 'players', STORE_KEY, { gear, race, v: zeroVersions(PLAYER_FIELDS) } as never);
	const player = { storeKey: STORE_KEY, sim: { store }, getGear: () => gear, canDualWield2H: () => false, setGear: vi.fn() } as unknown as Player<any>;
	return { store, ...render(<SimHostProvider host={fakeHost({ player })}>{<UpgradeCostsSummary />}</SimHostProvider>) };
};

const currencyIcon = (container: HTMLElement) =>
	container.querySelector<HTMLImageElement>('[data-testid="summary-table-row"] [data-testid="gem-icon"]')?.getAttribute('src');

describe('UpgradeCostsSummary', () => {
	it('names the honor currency icon after the faction', () => {
		const { container } = renderSummary(Race.RaceOrc);

		expect(currencyIcon(container)).toContain('pvpcurrency-honor-horde');
	});

	it('repaints the honor currency icon when the race changes without the gear changing', () => {
		const { store, container } = renderSummary(Race.RaceOrc);

		act(() => patchKeyed(store, 'players', STORE_KEY, { race: Race.RaceHuman }, ['race']));

		expect(currencyIcon(container)).toContain('pvpcurrency-honor-alliance');
	});
});
