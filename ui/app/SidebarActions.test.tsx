import { act, render } from '@testing-library/react';
import { SidebarRegistry } from '@ui-kit/sidebar_registry';
import { SidebarActionButton, SidebarDisabledContext } from '@ui-kit/SidebarActionButton';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarActions } from './SidebarActions';

let container: HTMLElement;

// `SimApp` provides the gate around this and the sim's own two actions alike, so the test does too.
const actions = (registry: SidebarRegistry, disabled = false) => (
	<SidebarDisabledContext value={disabled}>
		<SidebarActions registry={registry} />
	</SidebarDisabledContext>
);

const renderActions = (registry: SidebarRegistry, disabled = false) => render(actions(registry, disabled), { container });

const buttons = () => [...container.querySelectorAll('button')];

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
});

describe('SidebarActions', () => {
	it('renders entries in the registry order, buttons and custom entries alike', () => {
		const registry = new SidebarRegistry();
		registry.add({ id: 'dps-action', label: 'Simulate', testId: 'dps-action', onClick: () => {} });
		registry.add({ id: 'custom', render: () => <div className="custom-entry" /> });
		registry.add({ id: 'ep-weights-action', label: 'Stat Weights', testId: 'ep-weights-action', onClick: () => {} });

		expect(container.children).toHaveLength(0);
		renderActions(registry);
		expect([...container.children].map(child => child.getAttribute('data-testid') === 'dps-action')).toEqual([true, false, false]);
		expect([...container.children][1].classList.contains('custom-entry')).toBe(true);
		expect([...container.children].map(child => child.getAttribute('data-testid') === 'ep-weights-action')).toEqual([false, false, true]);
		[0, 2].forEach(i => {
			const child = [...container.children][i];
			expect(child.tagName).toBe('BUTTON');
			expect(child.hasAttribute('data-sidebar-action')).toBe(true);
			expect(child.classList.contains('w-full')).toBe(true);
		});
	});

	// The whole point of the context: a spec rendering its own button through `render` cannot opt out
	// of the unlaunched-sim gate by forgetting to thread the flag.
	it('disables a custom entry that uses the shared button, not just declarative entries', () => {
		const registry = new SidebarRegistry();
		registry.add({ id: 'dps-action', label: 'Simulate', onClick: () => {} });
		registry.add({ id: 'custom', render: () => <SidebarActionButton onClick={() => {}}>Spec thing</SidebarActionButton> });

		renderActions(registry, true);

		expect(buttons().map(button => button.disabled)).toEqual([true, true]);
	});

	it('leaves the buttons enabled on a launched sim unless the entry itself is disabled', () => {
		const registry = new SidebarRegistry();
		const action = registry.add({ id: 'dps-action', label: 'Simulate', onClick: () => {} });
		registry.add({ id: 'custom', render: () => <SidebarActionButton onClick={() => {}}>Spec thing</SidebarActionButton> });

		const { rerender } = renderActions(registry);
		expect(buttons().map(button => button.disabled)).toEqual([false, false]);

		act(() => action.update({ disabled: true }));
		rerender(actions(registry));
		expect(buttons().map(button => button.disabled)).toEqual([true, false]);
	});

	it('reflects a loading update as aria-busy', () => {
		const registry = new SidebarRegistry();
		const action = registry.add({ id: 'ep-weights-action', label: 'Stat Weights', onClick: () => {}, loading: true });

		const { rerender } = renderActions(registry);
		expect(buttons()[0].getAttribute('aria-busy')).toBe('true');

		act(() => action.update({ loading: false }));
		rerender(actions(registry));
		expect(buttons()[0].getAttribute('aria-busy')).toBeNull();
	});

	it('calls the entry onClick', () => {
		const onClick = vi.fn();
		const registry = new SidebarRegistry();
		registry.add({ id: 'dps-action', label: 'Simulate', onClick });

		renderActions(registry);
		buttons()[0].click();

		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
