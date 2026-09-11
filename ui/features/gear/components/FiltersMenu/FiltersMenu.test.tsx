import { ArmorType, ItemSlot, RangedWeaponType, WeaponType } from '@generated/proto/common';
import { DatabaseFilters, SourceFilterOption, UIItem_FactionRestriction } from '@generated/proto/ui';
import { SimHostProvider } from '@sim/context/SimHostContext';
import type { IndividualSimHost } from '@sim/sim_host';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		subscribe: (callback: () => void) => {
			listeners.add(callback);
			return () => listeners.delete(callback);
		},
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribeSimField: () => store.subscribe,
	subscribeUiField: () => store.subscribe,
	subscribeAll: () => store.subscribe,
}));

const { FiltersMenu } = await import('./FiltersMenu');

interface ClassStub {
	armorTypes?: ArmorType[];
	weaponTypes?: WeaponType[];
	rangedWeaponTypes?: RangedWeaponType[];
	canDualWield?: boolean;
}

describe('FiltersMenu', () => {
	let filters: DatabaseFilters;
	let setFilters: ReturnType<typeof vi.fn>;
	let rootElem: HTMLElement;

	const setup = (
		{ armorTypes = [ArmorType.ArmorTypeMail, ArmorType.ArmorTypePlate], weaponTypes = [], rangedWeaponTypes = [], canDualWield = false }: ClassStub = {},
		{ slot = ItemSlot.ItemSlotHead, open = true, onOpenChange = vi.fn() } = {},
	) => {
		// A fresh root per mount: two mounts in one test compare two class shapes, and React must be
		// left to unmount its own portal rather than have the container emptied under it.
		rootElem = document.createElement('div');
		rootElem.className = 'sim-ui';
		document.body.appendChild(rootElem);
		const host = {
			rootElem,
			player: {
				sim: {
					getFilters: () => DatabaseFilters.clone(filters),
					setFilters,
				},
				getPlayerClass: () => ({ armorTypes, weaponTypes: weaponTypes.map(weaponType => ({ weaponType })), rangedWeaponTypes }),
				getPlayerSpec: () => ({ canDualWield }),
			},
		} as unknown as IndividualSimHost<any>;

		render(
			<SimHostProvider host={host}>
				<FiltersMenu slot={slot} open={open} onOpenChange={onOpenChange} />
			</SimHostProvider>,
		);
		return { onOpenChange };
	};

	const sections = () => Array.from(rootElem.querySelectorAll('.menu-section-title')).map(node => node.textContent);
	const pickerIds = () => Array.from(rootElem.querySelectorAll<HTMLElement>('.filters-menu [id^=filter]')).map(node => node.id);

	beforeEach(() => {
		filters = DatabaseFilters.create({});
		setFilters = vi.fn((next: DatabaseFilters) => {
			filters = next;
		});
	});

	it('portals into the sim root so the popup keeps the spec theme', () => {
		setup();
		expect(rootElem.querySelector('.sim-dialog-popup.filters-menu')).not.toBeNull();
		expect(document.body.querySelector(':scope > .sim-dialog-popup')).toBeNull();
	});

	it('renders nothing while closed', () => {
		setup({}, { open: false });
		expect(rootElem.querySelector('.filters-menu')).toBeNull();
	});

	it('always offers the general, source and raid sections', () => {
		setup({ armorTypes: [] }, { slot: ItemSlot.ItemSlotTrinket1 });
		expect(sections()).toEqual(['gear_tab.gear_picker.filters.general', 'gear_tab.gear_picker.filters.source', 'gear_tab.gear_picker.filters.raids']);
	});

	it('adds the armor type section to an armor slot, and only for a class with more than one', () => {
		setup();
		expect(sections()).toContain('gear_tab.gear_picker.armor_type');
		expect(pickerIds()).toContain(`filters-armor-type-${ArmorType.ArmorTypePlate}`);

		setup({ armorTypes: [ArmorType.ArmorTypePlate] });
		expect(sections()).not.toContain('gear_tab.gear_picker.armor_type');
	});

	it('gives a weapon slot the weapon type and speed sections instead', () => {
		setup({ weaponTypes: [WeaponType.WeaponTypeAxe, WeaponType.WeaponTypeSword] }, { slot: ItemSlot.ItemSlotMainHand });

		expect(sections()).toEqual([
			'gear_tab.gear_picker.filters.general',
			'gear_tab.gear_picker.filters.source',
			'gear_tab.gear_picker.filters.raids',
			'gear_tab.gear_picker.weapon_type',
			'gear_tab.gear_picker.weapon_speed',
		]);
		expect(pickerIds()).toContain(`filters-weapon-type-${WeaponType.WeaponTypeSword}`);
		expect(sections()).not.toContain('gear_tab.gear_picker.armor_type');
	});

	it('offers the off hand speed pickers only to a spec that can dual wield', () => {
		setup({ weaponTypes: [WeaponType.WeaponTypeAxe] }, { slot: ItemSlot.ItemSlotMainHand });
		expect(pickerIds()).not.toContain('filters-min-oh-weapon-speed');

		setup({ weaponTypes: [WeaponType.WeaponTypeAxe], canDualWield: true }, { slot: ItemSlot.ItemSlotMainHand });
		expect(pickerIds()).toEqual(expect.arrayContaining(['filters-min-oh-weapon-speed', 'filters-max-oh-weapon-speed']));
	});

	it('adds the ranged sections to a weapon slot only for a class with ranged weapons', () => {
		setup({ weaponTypes: [WeaponType.WeaponTypeAxe] }, { slot: ItemSlot.ItemSlotMainHand });
		expect(sections()).not.toContain('gear_tab.gear_picker.ranged_weapon_type');

		setup({ weaponTypes: [WeaponType.WeaponTypeAxe], rangedWeaponTypes: [RangedWeaponType.RangedWeaponTypeBow] }, { slot: ItemSlot.ItemSlotMainHand });
		expect(sections()).toEqual([
			'gear_tab.gear_picker.filters.general',
			'gear_tab.gear_picker.filters.source',
			'gear_tab.gear_picker.filters.raids',
			'gear_tab.gear_picker.weapon_type',
			'gear_tab.gear_picker.weapon_speed',
			'gear_tab.gear_picker.ranged_weapon_type',
			'gear_tab.gear_picker.ranged_weapon_speed',
		]);
	});

	it('offers the ranged sections to a class with no melee weapon types at all', () => {
		setup({ rangedWeaponTypes: [RangedWeaponType.RangedWeaponTypeGun] }, { slot: ItemSlot.ItemSlotMainHand });
		expect(sections()).not.toContain('gear_tab.gear_picker.weapon_type');
		expect(sections()).toContain('gear_tab.gear_picker.ranged_weapon_type');
	});

	it('shows an unset item level bound as an empty field rather than a zero', () => {
		filters = DatabaseFilters.create({ minIlvl: 0, maxIlvl: 528 });
		setup();

		expect(rootElem.querySelector<HTMLInputElement>('#filters-min-ilvl')!.value).toBe('');
		expect(rootElem.querySelector<HTMLInputElement>('#filters-max-ilvl')!.value).toBe('528');
	});

	it('writes a source toggle back through the sim, and drops it again', () => {
		const source = SourceFilterOption.SourceCrafting;
		setup();
		const checkbox = rootElem.querySelector<HTMLInputElement>(`#filters-source-${source}`)!;
		expect(checkbox.checked).toBe(false);

		fireEvent.click(checkbox);
		expect(setFilters).toHaveBeenCalledTimes(1);
		expect(setFilters.mock.calls[0][0].sources).toContain(source);

		act(() => store.notify());
		expect(rootElem.querySelector<HTMLInputElement>(`#filters-source-${source}`)!.checked).toBe(true);

		fireEvent.click(rootElem.querySelector<HTMLInputElement>(`#filters-source-${source}`)!);
		expect(setFilters.mock.calls[1][0].sources).not.toContain(source);
	});

	it('offers the three faction restrictions and writes the chosen one back', () => {
		setup();
		const select = rootElem.querySelector<HTMLSelectElement>('#filters-faction-restriction')!;

		expect(Array.from(select.options).map(option => Number(option.value))).toEqual([
			UIItem_FactionRestriction.UNSPECIFIED,
			UIItem_FactionRestriction.ALLIANCE_ONLY,
			UIItem_FactionRestriction.HORDE_ONLY,
		]);

		select.value = String(UIItem_FactionRestriction.HORDE_ONLY);
		fireEvent.change(select);
		expect(setFilters.mock.calls[0][0].factionRestriction).toBe(UIItem_FactionRestriction.HORDE_ONLY);
	});

	it('closes on its own close button', () => {
		const { onOpenChange } = setup();

		fireEvent.click(rootElem.querySelector<HTMLButtonElement>('.filters-menu .sim-dialog-close')!);
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});
});
