import { render } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The shell is stubbed on purpose. What is under test is the construct-once gate, not the shell —
// and constructing the real one would need a Database and a worker.
const constructions: HTMLElement[] = [];
vi.mock('./individual_sim_ui', () => ({
	IndividualSimUI: class {
		constructor(parent: HTMLElement) {
			constructions.push(parent);
			const root = document.createElement('div');
			root.className = 'sim-ui';
			parent.appendChild(root);
		}
	},
}));

const { SimApp } = await import('./sim_app');

const player = {} as never;
const def = {} as never;

describe('SimApp', () => {
	beforeEach(() => {
		constructions.length = 0;
	});

	it('constructs the shell once', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		expect(constructions).toHaveLength(1);
		expect(container.querySelectorAll('.sim-ui')).toHaveLength(1);
	});

	it('still constructs once under StrictMode, whose effects run twice', () => {
		// This is the whole reason the gate exists. Constructing the shell subscribes autosave with no
		// unsubscribe and queues work on sim.waitForInit(), so a second construction cannot be undone
		// by a cleanup function — it has to not happen.
		const { container } = render(
			<StrictMode>
				<SimApp player={player} def={def} />
			</StrictMode>,
		);
		expect(constructions).toHaveLength(1);
		expect(container.querySelectorAll('.sim-ui')).toHaveLength(1);
	});

	it('mounts the shell into its own container', () => {
		const { container } = render(<SimApp player={player} def={def} />);
		const mount = container.querySelector('.sim-app')!;
		expect(constructions[0]).toBe(mount);
		expect(mount.querySelector('.sim-ui')).not.toBeNull();
	});
});
