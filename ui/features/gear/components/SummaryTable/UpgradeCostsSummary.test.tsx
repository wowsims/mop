import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player';
import type { EquippedItem } from '@sim/proto_utils/equipped_item';
import type { IndividualSimHost } from '@sim/sim_host';
import { Faction, ItemQuality } from '@generated/proto/common';
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { listeners } = vi.hoisted(() => ({ listeners: new Map<string, Set<() => void>>() }));

vi.mock('@sim/state/subscriptions', () => ({
	subscribePlayerField: (_player: unknown, field: string) => (callback: () => void) => {
		const forField = listeners.get(field) ?? new Set<() => void>();
		listeners.set(field, forField);
		forField.add(callback);
		return () => forField.delete(callback);
	},
}));

const { UpgradeCostsSummary } = await import('./UpgradeCostsSummary');

const gladiatorCloak = {
	_item: { scalingOptions: {}, name: "Gladiator's Cloak of Prowess", nameDescription: '', phase: 4, quality: ItemQuality.ItemQualityEpic },
	upgrade: 0,
	getMaxUpgradeCount: () => 2,
} as unknown as EquippedItem;

const renderSummary = (faction: () => Faction) => {
	const gear = { asArray: () => [gladiatorCloak] };
	const player = { getGear: () => gear, getFaction: faction, canDualWield2H: () => false, setGear: vi.fn() } as unknown as Player<any>;
	return render(
		<SimHostProvider host={{ player } as unknown as IndividualSimHost<any>}>
			<UpgradeCostsSummary />
		</SimHostProvider>,
	);
};

const currencyIcon = (container: HTMLElement) => container.querySelector<HTMLImageElement>('.summary-table-row .gem-icon')?.getAttribute('src');

describe('UpgradeCostsSummary', () => {
	it('names the honor currency icon after the faction', () => {
		const { container } = renderSummary(() => Faction.Horde);

		expect(currencyIcon(container)).toContain('pvpcurrency-honor-horde');
	});

	it('repaints the honor currency icon when the race changes without the gear changing', () => {
		let faction = Faction.Horde;
		const { container } = renderSummary(() => faction);

		faction = Faction.Alliance;
		act(() => listeners.get('race')?.forEach(callback => callback()));

		expect(currencyIcon(container)).toContain('pvpcurrency-honor-alliance');
	});
});
