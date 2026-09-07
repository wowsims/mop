import { describe, expect, it, vi } from 'vitest';

import { Component } from './component';

class Probe extends Component {
	constructor() {
		super(null);
	}

	get disposedNow() {
		return this.isDisposed;
	}
}

describe('Component disposal', () => {
	it('runs a registered callback once, on dispose', () => {
		const component = new Probe();
		const callback = vi.fn();

		component.addOnDisposeCallback(callback);
		expect(callback).not.toHaveBeenCalled();

		component.dispose();
		component.dispose();
		expect(callback).toHaveBeenCalledTimes(1);
	});

	// The defect: an async constructor callback that registers after the component was already
	// discarded pushed onto a list dispose() had emptied, so the subscription ran forever.
	it('runs a callback registered after disposal, instead of leaking it', () => {
		const component = new Probe();
		component.dispose();

		const callback = vi.fn();
		component.addOnDisposeCallback(callback);

		expect(callback).toHaveBeenCalledTimes(1);
	});

	it('disposes a child added after disposal, instead of leaking it', () => {
		const parent = new Probe();
		parent.dispose();

		const child = new Probe();
		expect(parent.addChild(child)).toBe(child);
		expect(child.disposedNow).toBe(true);
	});

	it('disposes children with their parent', () => {
		const parent = new Probe();
		const child = parent.addChild(new Probe());

		expect(child.disposedNow).toBe(false);
		parent.dispose();
		expect(child.disposedNow).toBe(true);
	});
});
