import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, render } from '@testing-library/react';
import type { InputConfig } from '@ui-kit/input';
import { describe, expect, it } from 'vitest';

import { useInput } from './input';

// The encounter target list is written this way: getTargets().slice(), a new array every call.
class Targets {
	private listeners = new Set<() => void>();
	private ids = [1, 2];
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
	add(id: number) {
		this.ids = [...this.ids, id];
		this.listeners.forEach(listener => listener());
	}
	all() {
		return this.ids.slice();
	}
}

const config: InputConfig<Targets, number[]> = {
	storeSubscribe: targets => targets.subscribe,
	getValue: targets => targets.all(),
	setValue: () => {},
};

describe('useInput', () => {
	it('holds the snapshot between notifications, so a fresh array per call does not loop', () => {
		let renders = 0;
		const targets = new Targets();
		const Probe = () => {
			const { value } = useInput(targets, config);
			renders++;
			return <span>{value.join(',')}</span>;
		};

		const { container } = render(<Probe />);
		const initialRenders = renders;
		expect(container.textContent).toBe('1,2');

		// Any further render would be a new snapshot identity feeding back into the store read.
		expect(initialRenders).toBeLessThanOrEqual(4);

		act(() => targets.add(3));
		expect(container.textContent).toBe('1,2,3');
	});
});

describe('useInput revision', () => {
	it('counts notifications from its own source only', () => {
		const own = new Set<() => void>();
		const unrelated = new Set<() => void>();
		const mod = { value: 1 };
		const config = {
			storeSubscribe: () => (listener: () => void) => {
				own.add(listener);
				return () => own.delete(listener);
			},
			getValue: (m: typeof mod) => m.value,
			setValue: () => {},
		};

		let renders = 0;
		const Probe = () => {
			const { revision } = useInput(mod, config);
			renders++;
			return <span>{revision}</span>;
		};
		const { container } = render(<Probe />);
		const atMount = renders;

		// A store the picker never subscribed to: no listener of ours to call, so nothing re-renders.
		act(() => unrelated.forEach(listener => listener()));
		expect(renders).toBe(atMount);
		expect(container.textContent).toBe('0');

		// Its own source, with the value unchanged — vanilla refresh() still runs, so this must render.
		act(() => own.forEach(listener => listener()));
		expect(container.textContent).toBe('1');
	});
});
