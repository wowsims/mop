import { SimHostProvider } from '@sim/context/SimHostContext';
import type { CustomSection as CustomSectionConfig } from '@sim/spec_config';
import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real source selects from a zustand store on `player.sim`; this file is about *whether* the
// section subscribes and what it does with the answer, so the source is stubbed and driven directly.
const source = vi.hoisted(() => {
	const listeners = new Set<() => void>();
	return { listeners, subscribed: 0, notify: () => listeners.forEach(listener => listener()) };
});
vi.mock('@sim/state/subscriptions', async () => {
	const { mockSubscriptions, noopSubscribe } = await import('@sim/testing');
	return mockSubscriptions(noopSubscribe, {
		subscribePlayerChange: () => {
			source.subscribed++;
			return (onChange: () => void) => {
				source.listeners.add(onChange);
				return () => source.listeners.delete(onChange);
			};
		},
	});
});

// Both take a live player and are covered by their own suites.
vi.mock('@ui-kit/IconPicker', () => ({
	IconPicker: ({ config }: { config: { inline?: boolean } }) => (
		<div className="icon-picker-root" data-testid="icon-picker-root" data-inline={String(!!config.inline)} />
	),
}));
vi.mock('../InputPicker', () => ({
	InputPicker: ({ config }: { config: { id: string; inline?: boolean } }) => (
		<div data-testid="input-picker-stub" data-id={config.id} data-inline={String(!!config.inline)} />
	),
}));

const { CustomSection } = await import('./CustomSection');

/** Stands in for the player: the one flag the `when` predicates below ask about. */
const player = { shown: true };

const mount = (section: Partial<CustomSectionConfig<any>>) => {
	const { container } = render(
		<SimHostProvider host={{ player } as never}>
			<CustomSection section={{ id: 'totems', title: 'Totems', ...section } as CustomSectionConfig<any>} />
		</SimHostProvider>,
	);
	return container.querySelector('[data-testid="content-block"]') as HTMLElement;
};

describe('CustomSection', () => {
	beforeEach(() => {
		player.shown = true;
		source.listeners.clear();
		source.subscribed = 0;
	});

	it('is a content block named by className', () => {
		const classes = [...mount({ className: 'custom-section-example' }).classList];
		expect(classes).toHaveLength(4);
		for (const token of ['ui-content-block', 'flex', 'flex-col', 'custom-section-example']) expect(classes).toContain(token);
	});

	it('falls back to the section id when it declares no className', () => {
		expect(mount({}).classList.contains('totems')).toBe(true);
	});

	it('renders the title into the block header', () => {
		expect(mount({}).querySelector('[data-testid="content-block-title"]')!.textContent).toBe('Totems');
	});

	it('renders its icons and inputs into the block body, both forced inline', () => {
		const block = mount({
			iconInputs: [{ type: 'icon' }] as never,
			inputs: [{ id: 'disable-immolate', type: 'boolean' }] as never,
			iconGroupClassName: 'totem-dropdowns-container',
		});
		const body = block.querySelector('[data-testid="content-block-body"]')!;
		expect(body.querySelector('[data-picker-group].totem-dropdowns-container.ui-picker-group-icons')).not.toBeNull();
		expect(body.querySelector('[data-testid="icon-picker-root"]')!.getAttribute('data-inline')).toBe('true');
		expect(body.querySelector('[data-testid="input-picker-stub"]')!.getAttribute('data-inline')).toBe('true');
	});

	it('does not subscribe at all when the section declares no `when`', () => {
		mount({});
		expect(source.subscribed).toBe(0);
		expect(source.listeners.size).toBe(0);
	});

	it('renders no block at all when `when` is false at mount', () => {
		expect(mount({ when: () => false })).toBeNull();
	});

	it('unmounts and remounts the block as the player changes', () => {
		const block = () => document.querySelector('[data-testid="content-block"]');
		mount({ when: ((subject: typeof player) => subject.shown) as unknown as CustomSectionConfig<any>['when'] });
		expect(block()).toBeTruthy();

		act(() => {
			player.shown = false;
			source.notify();
		});
		expect(block()).toBeNull();

		act(() => {
			player.shown = true;
			source.notify();
		});
		expect(block()).toBeTruthy();
	});
});
