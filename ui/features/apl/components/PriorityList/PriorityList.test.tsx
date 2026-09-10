import { makePlayer } from '@features/apl/testing';
import { APLListItem, APLRotation } from '@generated/proto/apl';
import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, fireEvent, render } from '@testing-library/react';
import { beginDrag, endDrag } from '@ui-kit/ListPicker/drag_state';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PriorityList } from './PriorityList';

const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => Array.from(listeners).forEach(listener => listener()),
	};
});

vi.mock('@sim/state/subscriptions', () => ({
	subscribeAll: () => source.subscribe,
	subscribePlayerField: () => source.subscribe,
	subscribeUnitMetadata: () => source.subscribe,
}));
vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));
vi.mock('@sim/proto/action_id', () => ({ ActionId: { replaceAllInString: async (str: string) => str } }));

// FloatingActionBar's sticky-bar effect needs one; happy-dom does not provide it.
class FakeIntersectionObserver {
	constructor() {}
	observe = vi.fn();
	disconnect = vi.fn();
	unobserve = vi.fn();
}

let player: ReturnType<typeof makePlayer>;

const setup = (items: Array<APLListItem>) => {
	source.listeners.clear();
	const rotation = APLRotation.create({ priorityList: items });
	player = makePlayer(rotation, () => source.notify());
};

const mount = () =>
	render(
		<SimHostProvider host={{ player, rootElem: document.body, applyEmptyAplRotation: () => {} } as never}>
			<PriorityList />
		</SimHostProvider>,
	);

const listRoot = () => document.querySelector('.list-picker-root') as HTMLElement;
const rowContainers = () => Array.from(document.querySelectorAll('.list-picker-item-container'));

beforeEach(() => {
	document.body.innerHTML = '';
	vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
});

afterEach(() => {
	vi.unstubAllGlobals();
	endDrag();
});

describe('PriorityList', () => {
	it('renders one list-picker-root carrying apl-list-item-picker, one row per priorityList entry', () => {
		setup([APLListItem.create({ action: {} }), APLListItem.create({ action: {} })]);
		mount();

		expect(listRoot().className.split(' ')).toContain('apl-list-item-picker');
		expect(rowContainers()).toHaveLength(2);
		expect(document.querySelectorAll('.apl-list-item-picker-root')).toHaveLength(2);
	});

	it('orders each row’s header as validations then hide picker, and the body as an action picker', () => {
		setup([APLListItem.create({ action: { action: { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'seq' } } } })]);
		mount();

		const row = rowContainers()[0];
		const header = row.querySelector('.list-picker-item-header') as HTMLElement;
		const headerExtras = Array.from(header.querySelectorAll('.apl-validations, .hide-picker-root'));
		expect(headerExtras.map(el => el.className.split(' ')[1])).toEqual(['apl-validations', 'hide-picker-root']);

		const body = row.querySelector('.list-picker-item') as HTMLElement;
		expect(body.querySelector('.apl-action-picker-root')).not.toBeNull();
	});

	it('appends an APLListItem to priorityList through the floating action bar’s new button', () => {
		setup([]);
		const { container } = mount();

		expect(player.aplRotation.priorityList).toHaveLength(0);
		const newButton = container.querySelectorAll('.apl-floating-action-bar-root button')[0] as HTMLButtonElement;
		act(() => {
			fireEvent.click(newButton);
		});

		expect(player.aplRotation.priorityList).toHaveLength(1);
		expect(player.aplRotation.priorityList[0].action).toBeDefined();
	});

	// `sameGroupOnly` is what refuses a drop from a foreign list even when the item labels match —
	// reached here by driving the module-scoped drag state directly, the way `drag_state.ts` (see
	// its own header comment) says a cross-stack drag has to be simulated.
	it('refuses a drop from a different list even when the item label matches (sameGroupOnly)', () => {
		setup([APLListItem.create({ action: {} }), APLListItem.create({ action: {} })]);
		mount();

		const container = rowContainers()[0] as HTMLElement;
		beginDrag({
			listId: 'a-foreign-list',
			itemLabel: 'rotation_tab.apl.priorityList.name',
			index: 0,
			elem: document.createElement('div'),
			take: () => APLListItem.create({ action: {} }),
		});

		act(() => {
			fireEvent.dragEnter(container);
		});

		expect(container.className.split(' ')).not.toContain('dragto');
	});

	it('splices priorityList when a row is deleted through its item popover', () => {
		const keep = APLListItem.create({ action: { action: { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'seq' } } } });
		setup([APLListItem.create({ action: {} }), keep]);
		mount();

		act(() => {
			fireEvent.click(rowContainers()[0].querySelector(':scope > .list-picker-item-header > .list-picker-item-actions')!);
		});
		act(() => {
			fireEvent.click(rowContainers()[0].querySelector('.list-picker-item-delete')!);
		});

		expect(player.aplRotation.priorityList).toHaveLength(1);
		expect(player.aplRotation.priorityList[0]).toEqual(keep);
	});

	it('renders what a loaded rotation changed and keeps the rows it skipped editable', () => {
		const reset = (sequenceName: string) => APLListItem.create({ action: { action: { oneofKind: 'resetSequence', resetSequence: { sequenceName } } } });
		setup([reset('a'), reset('b')]);
		mount();
		const inputs = () => Array.from(document.querySelectorAll<HTMLInputElement>('.apl-action-resetSequence input'));
		const names = () => inputs().map(input => input.value);
		expect(names()).toEqual(['a', 'b']);

		act(() => {
			player.aplRotation = APLRotation.create({ priorityList: [reset('a'), reset('changed')] });
			source.notify();
		});
		expect(names()).toEqual(['a', 'changed']);

		act(() => {
			fireEvent.change(inputs()[0], { target: { value: 'typed' } });
		});
		expect(player.aplRotation.priorityList[0].action?.action).toEqual({ oneofKind: 'resetSequence', resetSequence: { sequenceName: 'typed' } });

		act(() => {
			player.aplRotation.priorityList[0].action!.action = { oneofKind: 'resetSequence', resetSequence: { sequenceName: 'edited' } };
			player.touchRotation();
		});
		expect(names()).toEqual(['edited', 'changed']);
	});
});
