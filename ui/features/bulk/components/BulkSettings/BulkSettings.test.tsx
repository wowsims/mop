import { ItemSlot } from '@generated/proto/common';
import { BulkSimItemSlot } from '@sim/bulk/constants_auto_gen';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { Player } from '@sim/player/player';
import type { EquippedItem } from '@sim/proto/equipped_item';
import { bulkState, seedBulkSettings } from '@sim/settings/bulk_settings';
import { createSimStore, PLAYER_FIELDS, seedKeyed, zeroVersions } from '@sim/state/sim_store';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@sim/bulk/utils', async () => {
	const actual = await vi.importActual<typeof import('@sim/bulk/utils')>('@sim/bulk/utils');
	return { ...actual, getBulkPlayerCanDualWield: () => true, getBulkFreezeWeaponTypes: () => [] };
});
vi.mock('../../model/run', () => ({ runBulkBatch: vi.fn() }));

const reforgePanelProps = vi.fn();
vi.mock('@features/reforge/components/ReforgePanel', () => ({
	ReforgeSettingsPanel: (props: Record<string, unknown>) => {
		reforgePanelProps(props);
		return <div data-testid="reforge-settings-body" />;
	},
}));

const { BulkSettings } = await import('./BulkSettings');

const STORE_KEY = 5;
const RING = { id: 1, equals: () => false } as unknown as EquippedItem;

const mount = (reforger: unknown = null) => {
	const store = createSimStore();
	const gear = { getEquippedItem: (slot: ItemSlot) => (slot === ItemSlot.ItemSlotFinger1 ? RING : null) };
	seedKeyed(store, 'players', STORE_KEY, { gear, v: zeroVersions(PLAYER_FIELDS) } as never);
	const player = { sim: { store, isNative: false }, storeKey: STORE_KEY, getGear: () => gear } as unknown as Player<any>;
	seedBulkSettings(player);
	const host = { player, sim: player.sim, reforger, reforgeOptions: null, getStorageKey: (key: string) => `test-${key}` } as never;
	const { container } = render(
		<SimHostProvider host={host}>
			<BulkSettings />
		</SimHostProvider>,
	);
	const select = (id: string) => container.querySelector<HTMLSelectElement>(`#${id}`)!;
	const openGroup = (group: string) => fireEvent.click(container.querySelector(`[data-testid="bulk-settings-group-${group}-trigger"]`)!);
	return { player, container, select, openGroup, checkbox: (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)! };
};

beforeEach(() => {
	localStorage.clear();
	reforgePanelProps.mockClear();
});

describe('BulkSettings', () => {
	it('shows the legacy bulk sim toggle as ticked after one click', () => {
		const { player, checkbox } = mount();
		const input = checkbox('use-legacy-bulk-sim');

		fireEvent.click(input);

		expect(bulkState(player).useLegacyBulkSim).toBe(true);
		expect(input.checked).toBe(true);
	});

	it('shows the inherit upgrades toggle as unticked after one click', () => {
		const { player, checkbox } = mount();
		const input = checkbox('inherit-upgrades');
		expect(input.checked).toBe(true);

		fireEvent.click(input);

		expect(bulkState(player).inheritUpgrades).toBe(false);
		expect(input.checked).toBe(false);
	});

	it('keeps the picked slot in the freeze ring select', () => {
		const { player, select, openGroup } = mount();
		openGroup('freezes');
		const ring = select('freeze-ring');

		fireEvent.change(ring, { target: { value: String(ItemSlot.ItemSlotFinger1) } });

		expect(bulkState(player).frozenItems.get(BulkSimItemSlot.ItemSlotFinger)).toBe(RING);
		expect(ring.value).toBe(String(ItemSlot.ItemSlotFinger1));
	});

	it('keeps the picked slot in the freeze weapon select', () => {
		const { player, select, openGroup } = mount();
		openGroup('freezes');
		const weapon = select('freeze-weapon');

		fireEvent.change(weapon, { target: { value: String(ItemSlot.ItemSlotMainHand) } });

		expect(bulkState(player).frozenWeaponSlot).toBe(ItemSlot.ItemSlotMainHand);
		expect(weapon.value).toBe(String(ItemSlot.ItemSlotMainHand));
	});

	it('opens only the batch options group before anything is stored', () => {
		const { container } = mount();

		expect(container.querySelector('#use-legacy-bulk-sim')).not.toBeNull();
		expect(container.querySelector('#freeze-ring')).toBeNull();
	});

	it('remembers an opened group in local storage', () => {
		const { openGroup } = mount();

		openGroup('freezes');

		expect(JSON.parse(localStorage.getItem('test-__bulkSettingsGroups')!)).toEqual(['options', 'freezes']);
	});

	it('leaves both groups open, since one does not close the other', () => {
		const { container, openGroup } = mount();

		openGroup('freezes');

		expect(container.querySelector('#use-legacy-bulk-sim')).not.toBeNull();
		expect(container.querySelector('#freeze-ring')).not.toBeNull();
	});

	it('renders no reforge group for a spec without a reforge optimizer', () => {
		const { container } = mount();

		expect(container.querySelector('[data-testid="bulk-settings-group-reforge"]')).toBeNull();
	});

	it('runs the reforge settings under their own id prefix, with the gem rows locked', () => {
		const reforger = { settings: {} };
		const { container, openGroup } = mount(reforger);

		openGroup('reforge');

		expect(container.querySelector('[data-testid="reforge-settings-body"]')).not.toBeNull();
		expect(reforgePanelProps).toHaveBeenCalledWith(expect.objectContaining({ model: reforger, idPrefix: 'bulk-reforge-optimizer', gemsLocked: true }));
	});
});
