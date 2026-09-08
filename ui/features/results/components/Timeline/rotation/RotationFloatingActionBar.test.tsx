import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RotationFloatingActionBar } from './RotationFloatingActionBar';
import { castRow, rotationModel } from './testing';

const observed: Array<{ callback: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];

beforeEach(() => {
	observed.length = 0;
	vi.stubGlobal(
		'IntersectionObserver',
		class {
			constructor(
				public callback: IntersectionObserverCallback,
				public options?: IntersectionObserverInit,
			) {
				observed.push({ callback, options });
			}
			observe() {}
			unobserve() {}
			disconnect() {}
			takeRecords() {
				return [];
			}
		},
	);
});

const MODEL = rotationModel(['Alpha', 'Beta', 'Gamma', 'Delta'].map((label, index) => castRow(`cast:${index}`, label, [])));

const mount = (hidden: Array<string> = []) => {
	const onToggle = vi.fn();
	const onShowAll = vi.fn();
	const view = render(<RotationFloatingActionBar model={MODEL} hidden={new Set(hidden)} onToggle={onToggle} onShowAll={onShowAll} />);
	return { ...view, onToggle, onShowAll, toggle: view.container.querySelector<HTMLButtonElement>('.rotation-fab-toggle')! };
};

const chips = (container: HTMLElement) => [...container.querySelectorAll<HTMLButtonElement>('.rotation-fab-chip')];

describe('RotationFloatingActionBar', () => {
	it('builds no chips until the drawer is opened', () => {
		const { container, toggle } = mount();
		expect(chips(container)).toHaveLength(0);

		fireEvent.click(toggle);
		expect(chips(container).map(chip => chip.textContent)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
		expect(container.querySelector('.rotation-fab-group-title')!.textContent).toBe('Player');
	});

	it('keeps the drawer open across a new result and rebuilds its chips', () => {
		const { container, toggle, rerender, onToggle, onShowAll } = mount();
		fireEvent.click(toggle);

		const next = rotationModel(['Epsilon', 'Zeta'].map((label, index) => castRow(`cast:${index}`, label, [])));
		rerender(<RotationFloatingActionBar model={next} hidden={new Set()} onToggle={onToggle} onShowAll={onShowAll} />);

		expect(container.querySelector('.rotation-floating-action-bar-root')!.getAttribute('data-expanded')).toBe('true');
		expect(chips(container).map(chip => chip.textContent)).toEqual(['Epsilon', 'Zeta']);
	});

	it('takes the collapsed chips out of the tab order with inert', () => {
		const { container, toggle } = mount();
		const inner = container.querySelector<HTMLElement>('.rotation-fab-panel-inner')!;
		expect(inner.hasAttribute('inert')).toBe(true);
		fireEvent.click(toggle);
		expect(inner.hasAttribute('inert')).toBe(false);
	});

	it('marks a hidden row’s chip off, and reports a click on it', () => {
		const { container, toggle, onToggle } = mount(['cast:1']);
		fireEvent.click(toggle);
		const [alpha, beta] = chips(container);
		expect(alpha.getAttribute('aria-checked')).toBe('true');
		expect(beta.getAttribute('aria-checked')).toBe('false');
		expect(beta.className).not.toContain('active');

		fireEvent.click(beta);
		expect(onToggle).toHaveBeenCalledWith('cast:1');
	});

	it('previews up to three hidden rows and marks the rest with an ellipsis', () => {
		expect(mount(['cast:0', 'cast:1']).container.querySelector('.rotation-fab-preview')!.textContent).toBe('Alpha, Beta');
		expect(mount(['cast:0', 'cast:1', 'cast:2', 'cast:3']).container.querySelector('.rotation-fab-preview')!.textContent).toBe('Alpha, Beta, Gamma, …');
	});

	it('ignores hidden keys the current model does not have', () => {
		const { container } = mount(['cast:0', 'from-another-result']);
		expect(container.querySelector('.rotation-fab-preview')!.textContent).toBe('Alpha');
	});

	it('offers show-all only while something is hidden', () => {
		expect(mount().container.querySelector<HTMLElement>('.rotation-fab-show-all')!.hidden).toBe(true);
		const { container, onShowAll } = mount(['cast:0']);
		const showAll = container.querySelector<HTMLElement>('.rotation-fab-show-all')!;
		expect(showAll.hidden).toBe(false);
		fireEvent.click(showAll);
		expect(onShowAll).toHaveBeenCalled();
	});

	it('closes on Escape and hands focus back to the toggle', () => {
		const { container, toggle } = mount();
		fireEvent.click(toggle);
		expect(container.querySelector('.rotation-floating-action-bar-root')!.getAttribute('data-expanded')).toBe('true');

		fireEvent.keyDown(chips(container)[0], { key: 'Escape' });
		expect(container.querySelector('.rotation-floating-action-bar-root')!.getAttribute('data-expanded')).toBe('false');
		expect(document.activeElement).toBe(toggle);
	});

	it('keeps one tab stop per group and walks it with the arrow keys, wrapping at both ends', () => {
		const { container, toggle } = mount();
		fireEvent.click(toggle);
		expect(chips(container).map(chip => chip.tabIndex)).toEqual([0, -1, -1, -1]);

		fireEvent.keyDown(chips(container)[0], { key: 'ArrowRight' });
		expect(document.activeElement).toBe(chips(container)[1]);
		expect(chips(container).map(chip => chip.tabIndex)).toEqual([-1, 0, -1, -1]);

		fireEvent.keyDown(chips(container)[1], { key: 'ArrowLeft' });
		fireEvent.keyDown(chips(container)[0], { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(chips(container)[3]);
	});

	it('pins itself against the viewport’s last pixel, reading the newest of a batched delivery', () => {
		const { container } = mount();
		const root = container.querySelector<HTMLElement>('.rotation-floating-action-bar-root')!;
		Object.defineProperty(root, 'clientHeight', { value: 44, configurable: true });
		expect(observed[0].options).toMatchObject({ rootMargin: '0px 0px -1px 0px', threshold: [0, 1] });

		// One delivery, oldest first: reading the first record would leave the bar unpinned.
		act(() => observed[0].callback([{ intersectionRatio: 1 }, { intersectionRatio: 0.5 }] as Array<IntersectionObserverEntry>, {} as IntersectionObserver));
		expect(root.className).toContain('stuck');

		act(() => observed[0].callback([{ intersectionRatio: 0.5 }, { intersectionRatio: 1 }] as Array<IntersectionObserverEntry>, {} as IntersectionObserver));
		expect(root.className).not.toContain('stuck');
	});
});
