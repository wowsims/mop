import { APLRotation_Type as APLRotationType } from '@generated/proto/apl';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RotationTypePicker } from './RotationTypePicker';

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
vi.mock('@sim/state/subscriptions', async () => (await import('@sim/testing')).mockSubscriptions(source.subscribe));
vi.mock('@i18n/config', () => ({
	default: {
		t: (key: string) =>
			(
				({
					'rotation_tab.common.rotation_type.auto': 'Auto',
					'rotation_tab.common.rotation_type.simple': 'Simple',
					'rotation_tab.common.rotation_type.apl': 'APL',
				}) as Record<string, string>
			)[key] ?? key,
	},
}));

/** The three members the picker reaches for on the host's player. */
class FakePlayer {
	constructor(
		private readonly simple: boolean,
		public type: APLRotationType = APLRotationType.TypeAuto,
	) {}
	hasSimpleRotationGenerator() {
		return this.simple;
	}
	getRotationType() {
		return this.type;
	}
	modifyAplRotation(apply: (rotation: { type: APLRotationType }) => void) {
		const draft = { type: this.type };
		apply(draft);
		this.type = draft.type;
		source.notify();
	}
}

const host = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@sim/context/SimHostContext', () => ({ useSimHost: () => host.current, useOptionalSimHost: () => host.current }));

const mount = (player: FakePlayer) => {
	host.current = { player };
	return render(<RotationTypePicker />);
};

const root = () => document.querySelector('.dropdown-picker-root') as HTMLElement;
const trigger = () => root().querySelector('.dropdown-picker-button') as HTMLButtonElement;
const items = () => [...root().querySelectorAll<HTMLElement>('.dropdown-picker-item')];
const open = () => act(() => void fireEvent.click(trigger()));

beforeEach(() => source.listeners.clear());

describe('RotationTypePicker', () => {
	it('is one element: the shell is the dropdown root, not a wrapper around it', () => {
		mount(new FakePlayer(true));

		expect(root().className.split(' ').sort()).toEqual(['dropdown', 'dropdown-picker-root', 'input-root']);
		expect(trigger().id).toBe('rotation-tab-rotation-type');
	});

	it('offers Simple only when the spec ships a rotation generator', async () => {
		mount(new FakePlayer(true));
		await open();
		expect(items().map(item => item.textContent)).toEqual(['Auto', 'Simple', 'APL']);
	});

	it('offers Auto and APL alone otherwise', async () => {
		mount(new FakePlayer(false));
		await open();
		expect(items().map(item => item.textContent)).toEqual(['Auto', 'APL']);
	});

	it('shows the rotation type the player currently holds', () => {
		mount(new FakePlayer(true, APLRotationType.TypeAPL));

		expect(trigger().textContent).toBe('APL');
	});

	it('writes the chosen type through modifyAplRotation and follows the store back', async () => {
		const player = new FakePlayer(true);
		mount(player);
		await open();

		await act(() => void fireEvent.click(items()[2]));

		expect(player.type).toBe(APLRotationType.TypeAPL);
		expect(trigger().textContent).toBe('APL');
	});

	it('follows a rotation change made elsewhere', () => {
		const player = new FakePlayer(true);
		mount(player);
		expect(trigger().textContent).toBe('Auto');

		act(() => player.modifyAplRotation(rotation => (rotation.type = APLRotationType.TypeSimple)));
		expect(trigger().textContent).toBe('Simple');
	});
});
