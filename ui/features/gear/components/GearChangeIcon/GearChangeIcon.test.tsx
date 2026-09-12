import { ItemSlot } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { createSimStore } from '@sim/state/sim_store';
import { fakeHost } from '@sim/testing';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@ui-kit/hooks/useActionId', () => ({ useActionId: () => ({ iconUrl: 'icon.png', name: 'Item', href: 'https://wowhead/item', ready: true }) }));
vi.mock('@ui-kit/hooks/useWowheadDataset', () => ({ useWowheadDataset: () => ({}) }));
vi.mock('@sim/proto/action_id/dom', () => ({ equippedItemWowheadTooltipData: () => Promise.resolve('') }));
vi.mock('../../model/empty_slot_icons', () => ({ getEmptySlotIconUrl: () => 'empty-slot.png' }));
vi.mock('@sim/proto/gems', () => ({ getEmptyGemSocketIconUrl: (color: number) => `socket-${color}.png` }));

const { GearChangeIcon } = await import('./GearChangeIcon');
const { gearChangeSockets } = await import('./utils');

const host = fakeHost({ player: { sim: { store: createSimStore() } } });

const item = ({ gems = [], sockets = [], reforge = undefined }: { gems?: Array<{ id: number; name: string } | null>; sockets?: number[]; reforge?: any }) =>
	({
		gems,
		gemSockets: sockets,
		reforge,
		allSocketColors: () => sockets,
		asActionId: () => ({}),
	}) as any;

const renderIcon = (props: Parameters<typeof GearChangeIcon>[0]) =>
	render(
		<SimHostProvider host={host}>
			<GearChangeIcon {...props} />
		</SimHostProvider>,
	);

describe('GearChangeIcon', () => {
	it('renders the empty frame for a slot with no item', () => {
		const { container } = renderIcon({ slot: ItemSlot.ItemSlotHead });

		expect(container.querySelector('.item-picker-icon-wrapper')?.getAttribute('style')).toContain('empty-slot.png');
		expect(container.querySelector('.gear-change-icon-link')?.getAttribute('href')).toBeNull();
		expect(container.querySelector('.gear-change-icon-reforge')?.classList.contains('d-none')).toBe(true);
		expect(container.querySelectorAll('.gem-socket-container')).toHaveLength(0);
	});

	it('paints the item icon, its wowhead link and the no-tooltip-icon marker', () => {
		const { container } = renderIcon({ slot: ItemSlot.ItemSlotHead, item: item({}) });

		expect(container.querySelector('.item-picker-icon-wrapper')?.getAttribute('style')).toContain('icon.png');
		const link = container.querySelector('.gear-change-icon-link')!;
		expect(link.getAttribute('href')).toBe('https://wowhead/item');
		expect(link.getAttribute('data-whtticon')).toBe('false');
	});

	it('shows the reforge marker when a reforge was added, and anchors its tooltip', () => {
		const { container } = renderIcon({ slot: ItemSlot.ItemSlotHead, item: item({ reforge: { fromStat: 0, toStat: 1 } }) });

		const marker = container.querySelector('.gear-change-icon-reforge')!;
		expect(marker.classList.contains('d-none')).toBe(false);
		expect(marker.getAttribute('data-tooltip-id')).toBeTruthy();
	});

	it('shows the reforge marker when a reforge was removed', () => {
		const { container } = renderIcon({
			slot: ItemSlot.ItemSlotHead,
			item: item({}),
			previousItem: item({ reforge: { fromStat: 0, toStat: 1 } }),
		});

		expect(container.querySelector('.gear-change-icon-reforge')?.classList.contains('d-none')).toBe(false);
	});

	it('marks only the sockets whose gem moved', () => {
		const { container } = renderIcon({
			slot: ItemSlot.ItemSlotHead,
			item: item({
				gems: [
					{ id: 1, name: 'Bold' },
					{ id: 9, name: 'Delicate' },
				],
				sockets: [1, 2],
			}),
			previousItem: item({
				gems: [
					{ id: 1, name: 'Bold' },
					{ id: 2, name: 'Precise' },
				],
				sockets: [1, 2],
			}),
		});

		const sockets = [...container.querySelectorAll('.gem-socket-container')];
		expect(sockets).toHaveLength(2);
		expect(sockets[0].classList.contains('interactive')).toBe(false);
		expect(sockets[0].querySelector('.fa-exclamation-circle')).toBeNull();
		expect(sockets[1].classList.contains('interactive')).toBe(true);
		expect(sockets[1].querySelector('.fa-exclamation-circle')).not.toBeNull();
		expect(sockets[1].getAttribute('data-tooltip-id')).toBeTruthy();
	});
});

describe('gearChangeSockets', () => {
	it('walks the previous item, so a slot that gained a socket does not report it changed', () => {
		const result = gearChangeSockets(
			item({
				gems: [
					{ id: 1, name: 'Bold' },
					{ id: 5, name: 'New' },
				],
				sockets: [1, 2],
			}),
			item({ gems: [{ id: 1, name: 'Bold' }], sockets: [1] }),
		);

		expect(result.map(entry => entry.changed)).toEqual([false, false]);
		expect(result.map(entry => entry.gemName)).toEqual(['Bold', 'New']);
	});

	it('reports nothing without a previous item', () => {
		expect(gearChangeSockets(item({ gems: [{ id: 1, name: 'Bold' }], sockets: [1] }), undefined).map(entry => entry.changed)).toEqual([false]);
	});

	it('reports an empty list when there is no item', () => {
		expect(gearChangeSockets(undefined, item({ gems: [], sockets: [1] }))).toEqual([]);
	});
});
