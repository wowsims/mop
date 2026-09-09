import { render } from '@testing-library/react';
import { SidebarRegistry } from '@ui-kit/sidebar_registry';
import { SidebarActionButton } from '@ui-kit/SidebarActionButton';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SidebarActions } from './SidebarActions';

let container: HTMLElement;

const renderActions = (registry: SidebarRegistry, disabled = false) => render(<SidebarActions registry={registry} container={container} disabled={disabled} />);

const buttons = () => [...container.querySelectorAll('button')];

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
});

describe('SidebarActions', () => {
	it('renders entries in the registry order, buttons and custom entries alike', () => {
		const registry = new SidebarRegistry();
		registry.add({ id: 'dps-action', label: 'Simulate', cssClass: 'dps-action', onClick: () => {} });
		registry.add({ id: 'custom', render: () => <div className="custom-entry" /> });
		registry.add({ id: 'ep-weights-action', label: 'Stat Weights', cssClass: 'ep-weights-action', onClick: () => {} });

		// Class *sets*, sorted: `Button` composes `btn btn-primary` ahead of the caller's classes, and
		// the parity gates sort class lists for the same reason — order carries no meaning.
		const classSets = () => [...container.children].map(child => [...child.classList].sort().join(' '));

		expect(classSets()).toEqual([]);
		renderActions(registry);
		expect(classSets()).toEqual([
			'btn btn-primary dps-action sim-sidebar-action-button w-100',
			'custom-entry',
			'btn btn-primary ep-weights-action sim-sidebar-action-button w-100',
		]);
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

		action.update({ disabled: true });
		rerender(<SidebarActions registry={registry} container={container} disabled={false} />);
		expect(buttons().map(button => button.disabled)).toEqual([true, false]);
	});

	it('reflects a loading update as the spinner class and aria-busy', () => {
		const registry = new SidebarRegistry();
		const action = registry.add({ id: 'ep-weights-action', label: 'Stat Weights', onClick: () => {}, loading: true });

		const { rerender } = renderActions(registry);
		expect(buttons()[0].classList.contains('loading')).toBe(true);
		expect(buttons()[0].getAttribute('aria-busy')).toBe('true');

		action.update({ loading: false });
		rerender(<SidebarActions registry={registry} container={container} disabled={false} />);
		expect(buttons()[0].classList.contains('loading')).toBe(false);
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
