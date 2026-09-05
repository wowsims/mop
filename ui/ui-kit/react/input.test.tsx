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
