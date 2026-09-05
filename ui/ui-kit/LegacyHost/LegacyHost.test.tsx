import { render } from '@testing-library/react';
import { Component } from '@ui-kit/component';
import { StrictMode } from 'react';
import { describe, expect, it } from 'vitest';

import { LegacyHost } from './LegacyHost';

// A minimal stand-in for a real ui-kit component: it renders something, registers a child and a
// dispose callback, and records every construction and teardown so the tests can count them.
const log: string[] = [];

class Child extends Component {
	constructor(parent: HTMLElement | null) {
		super(parent, 'probe-child');
	}
	override dispose() {
		if (!this.isDisposed) log.push('child:dispose');
		super.dispose();
	}
}

class Probe extends Component {
	constructor(parent: HTMLElement, label: string) {
		super(parent, 'probe');
		this.rootElem.textContent = label;
		this.addChild(new Child(this.rootElem));
		this.addOnDisposeCallback(() => log.push('probe:callback'));
		log.push('probe:create:' + label);
	}
	override dispose() {
		if (!this.isDisposed) log.push('probe:dispose');
		super.dispose();
	}
}

describe('LegacyHost', () => {
	it('mounts the legacy component into the React tree', () => {
		log.length = 0;
		const { container } = render(<LegacyHost create={p => new Probe(p, 'a')} />);
		expect(container.querySelector('.probe')?.textContent).toBe('a');
		expect(container.querySelector('.probe-child')).not.toBeNull();
		expect(log).toEqual(['probe:create:a']);
	});

	it('disposes the component and detaches its element on unmount', () => {
		log.length = 0;
		const { container, unmount } = render(<LegacyHost create={p => new Probe(p, 'a')} />);
		const root = container.querySelector('.probe')!;
		unmount();
		// dispose() cascades to registered children and runs dispose callbacks...
		expect(log).toEqual(['probe:create:a', 'probe:dispose', 'child:dispose', 'probe:callback']);
		// ...and the bridge is what takes the element out of the document.
		expect(root.isConnected).toBe(false);
	});

	it('leaves exactly one instance under StrictMode, which mounts effects twice', () => {
		log.length = 0;
		const { container } = render(
			<StrictMode>
				<LegacyHost create={p => new Probe(p, 'a')} />
			</StrictMode>,
		);
		// The double-invoke must not leave a second, orphaned DOM tree behind.
		expect(container.querySelectorAll('.probe')).toHaveLength(1);
		expect(log.filter(l => l.startsWith('probe:create')).length - log.filter(l => l === 'probe:dispose').length).toBe(1);
	});

	it('rebuilds only when deps change, not on every render', () => {
		log.length = 0;
		const { rerender, container } = render(<LegacyHost create={p => new Probe(p, 'a')} deps={['a']} />);
		// A new inline `create` identity on a re-render must not rebuild anything.
		rerender(<LegacyHost create={p => new Probe(p, 'a')} deps={['a']} />);
		expect(log.filter(l => l.startsWith('probe:create'))).toEqual(['probe:create:a']);

		rerender(<LegacyHost create={p => new Probe(p, 'b')} deps={['b']} />);
		expect(log.filter(l => l.startsWith('probe:create'))).toEqual(['probe:create:a', 'probe:create:b']);
		// The replaced component's element must be gone, not stacked up beside the new one.
		expect(container.querySelectorAll('.probe')).toHaveLength(1);
		expect(container.querySelector('.probe')?.textContent).toBe('b');
	});
});
