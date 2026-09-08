import { Cooldown, Cooldowns } from '@generated/proto/common';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { ActionId } from '@sim/proto/action_id';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CooldownsPicker } from './CooldownsPicker';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => listeners.forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribeAll: () => source.subscribe,
	subscribePlayerField: () => source.subscribe,
	subscribeUnitMetadata: () => source.subscribe,
}));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const NAMES: Record<number, string> = { 1: 'Recklessness', 2: 'Skull Banner', 3: 'Avatar' };

const majorCooldown = (spellId: number) => ({ id: ActionId.fromSpellId(spellId), data: { isMajorCooldown: true } });

const cooldownFor = (spellId: number, timings: Array<number> = []) => Cooldown.create({ id: ActionId.fromSpellId(spellId).toProto(), timings });

let stored: Cooldowns;
let spells: Array<ReturnType<typeof majorCooldown>>;
let player: any;

const setup = (initial: Array<Cooldown>, available = [1, 2, 3]) => {
	source.listeners.clear();
	stored = Cooldowns.create({ cooldowns: initial });
	spells = available.map(majorCooldown);
	player = {
		hiddenMCDs: [],
		sim: {},
		getMetadata: () => ({ getSpells: () => spells }),
		getSimpleCooldowns: () => Cooldowns.clone(stored),
		setSimpleCooldowns: (next: Cooldowns) => {
			stored = next;
			source.notify();
		},
	};
};

const mount = (block = document.createElement('div')) => {
	block.classList.add('cooldown-settings');
	document.body.appendChild(block);
	render(
		<SimHostProvider host={{ player } as never}>
			<CooldownsPicker />
		</SimHostProvider>,
		{ container: block },
	);
	return block;
};

const rows = () => Array.from(document.querySelectorAll('.cooldown-picker'));
const labels = () => rows().map(row => row.querySelector('.cooldown-picker-label')!.textContent);
const deleteButton = (index: number) => rows()[index].querySelector('.delete-cooldown') as HTMLButtonElement;
const timingsInput = (index: number) => rows()[index].querySelector('.number-list-picker-input') as HTMLInputElement;

beforeEach(() => {
	// A filled ActionId as fill() returns one, so useActionId resolves synchronously and no test
	// touches the network — the pattern IconEnumPicker.test.tsx uses.
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return Object.assign(Object.create(ActionId.prototype), this, { name: NAMES[this.spellId] ?? '', iconUrl: 'icon.jpg' }) as ActionId;
	});
});

describe('CooldownsPicker', () => {
	it('renders a row per cooldown plus a trailing row that adds one', () => {
		setup([cooldownFor(1), cooldownFor(2)]);
		mount();

		expect(rows()).toHaveLength(3);
		expect(rows().map(row => row.classList.contains('add-cooldown-picker'))).toEqual([false, false, true]);
	});

	it('names each row after its own cooldown, and leaves the trailing row unnamed', async () => {
		setup([cooldownFor(3), cooldownFor(1)]);
		mount();
		await act(async () => {});

		expect(labels()).toEqual(['Avatar', 'Recklessness', '']);
	});

	it('deletes the row that was clicked rather than the last one', () => {
		setup([cooldownFor(1), cooldownFor(2), cooldownFor(3)]);
		mount();

		act(() => {
			fireEvent.click(deleteButton(0));
		});

		expect(stored.cooldowns.map(cooldown => cooldown.id!.rawId)).toEqual([2, 3].map(id => ActionId.fromSpellId(id).toProto().rawId));
		expect(rows()).toHaveLength(3);
	});

	it('grows and shrinks with the stored list', () => {
		setup([cooldownFor(1)]);
		mount();
		expect(rows()).toHaveLength(2);

		act(() => {
			player.setSimpleCooldowns(Cooldowns.create({ cooldowns: [cooldownFor(1), cooldownFor(2)] }));
		});
		expect(rows()).toHaveLength(3);
	});

	it('leaves the timings input disabled until the row has an action', () => {
		setup([cooldownFor(1)]);
		mount();

		expect(timingsInput(0).disabled).toBe(false);
		expect(timingsInput(1).disabled).toBe(true);
	});

	it('shows the stored timings of its own row', () => {
		setup([cooldownFor(1, [10, 20]), cooldownFor(2, [30])]);
		mount();

		expect([timingsInput(0).value, timingsInput(1).value]).toEqual(['10,20', '30']);
	});

	it('hides the containing block while the spec offers no major cooldowns', () => {
		setup([], []);
		const block = mount();
		expect(block.classList.contains('hide')).toBe(true);

		act(() => {
			spells = [majorCooldown(1)];
			source.notify();
		});
		expect(block.classList.contains('hide')).toBe(false);
	});

	// The vanilla button carries no `btn`, so the shared Button has to stay unstyled.
	it('renders the delete button with the vanilla class list and icon', () => {
		setup([cooldownFor(1)]);
		mount();

		expect(Array.from(deleteButton(0).classList).sort()).toEqual(['delete-cooldown', 'link-danger']);
		expect(Array.from(deleteButton(0).querySelector('i')!.classList).sort()).toEqual(['fa', 'fa-times', 'fa-xl']);
	});

	it('anchors every delete button to one shared tooltip', () => {
		setup([cooldownFor(1), cooldownFor(2)]);
		mount();

		const ids = rows().map(row => deleteButton(rows().indexOf(row)).getAttribute('data-tooltip-id'));
		expect(new Set(ids).size).toBe(1);
		expect(ids[0]).toBeTruthy();
	});
});
