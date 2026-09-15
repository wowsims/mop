import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RotationRowsToolbar } from './RotationRowsToolbar';
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
	const view = render(<RotationRowsToolbar model={MODEL} hidden={new Set(hidden)} onToggle={onToggle} onShowAll={onShowAll} />);
	return { ...view, onToggle, onShowAll, toggle: view.container.querySelector<HTMLButtonElement>('[data-testid="rotation-fab-toggle"]')! };
};

const chips = (container: HTMLElement) => [...container.querySelectorAll<HTMLButtonElement>('[data-testid="rotation-fab-chip"]')];
const panel = () => document.querySelector<HTMLElement>('[data-testid="rotation-fab-panel-inner"]');

describe('RotationRowsToolbar', () => {
	it('builds no chips until the drawer is opened', () => {
		const { container, toggle } = mount();
		expect(chips(container)).toHaveLength(0);

		fireEvent.click(toggle);
		expect(chips(document.body).map(chip => chip.textContent)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
		expect(document.querySelector('[data-testid="rotation-fab-group-title"]')!.textContent).toBe('Player');
	});

	it('keeps the drawer open across a new result and rebuilds its chips', () => {
		const { toggle, rerender, onToggle, onShowAll } = mount();
		fireEvent.click(toggle);

		const next = rotationModel(['Epsilon', 'Zeta'].map((label, index) => castRow(`cast:${index}`, label, [])));
		rerender(<RotationRowsToolbar model={next} hidden={new Set()} onToggle={onToggle} onShowAll={onShowAll} />);

		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(chips(document.body).map(chip => chip.textContent)).toEqual(['Epsilon', 'Zeta']);
	});

	it('starts collapsed, with the drawer out of the tab order', () => {
		const { toggle } = mount();
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
		expect(panel()).toBeNull();

		fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');
		expect(panel()).not.toBeNull();
	});

	it('marks a hidden row’s chip off, and reports a click on it', () => {
		const { toggle, onToggle } = mount(['cast:1']);
		fireEvent.click(toggle);
		const [alpha, beta] = chips(document.body);
		expect(alpha.getAttribute('aria-checked')).toBe('true');
		expect(beta.getAttribute('aria-checked')).toBe('false');
		expect(beta.hasAttribute('data-active')).toBe(false);

		fireEvent.click(beta);
		expect(onToggle).toHaveBeenCalledWith('cast:1');
	});

	it('previews up to three hidden rows and marks the rest with an ellipsis', () => {
		expect(mount(['cast:0', 'cast:1']).container.querySelector('[data-testid="rotation-fab-preview"]')!.textContent).toBe('Alpha, Beta');
		expect(mount(['cast:0', 'cast:1', 'cast:2', 'cast:3']).container.querySelector('[data-testid="rotation-fab-preview"]')!.textContent).toBe(
			'Alpha, Beta, Gamma, …',
		);
	});

	it('ignores hidden keys the current model does not have', () => {
		const { container } = mount(['cast:0', 'from-another-result']);
		expect(container.querySelector('[data-testid="rotation-fab-preview"]')!.textContent).toBe('Alpha');
	});

	it('offers show-all only while something is hidden', () => {
		expect(mount().container.querySelector<HTMLElement>('[data-testid="rotation-fab-show-all"]')!.hidden).toBe(true);
		const { container, onShowAll } = mount(['cast:0']);
		const showAll = container.querySelector<HTMLElement>('[data-testid="rotation-fab-show-all"]')!;
		expect(showAll.hidden).toBe(false);
		fireEvent.click(showAll);
		expect(onShowAll).toHaveBeenCalled();
	});

	it('closes on Escape and hands focus back to the toggle', async () => {
		const { toggle } = mount();
		fireEvent.click(toggle);
		expect(toggle.getAttribute('aria-expanded')).toBe('true');

		fireEvent.keyDown(chips(document.body)[0], { key: 'Escape' });

		await waitFor(() => expect(document.activeElement).toBe(toggle));
		expect(toggle.getAttribute('aria-expanded')).toBe('false');
	});

	it('keeps one tab stop per group and walks it with the arrow keys, wrapping at both ends', () => {
		const { toggle } = mount();
		fireEvent.click(toggle);
		expect(chips(document.body).map(chip => chip.tabIndex)).toEqual([0, -1, -1, -1]);

		fireEvent.keyDown(chips(document.body)[0], { key: 'ArrowRight' });
		expect(document.activeElement).toBe(chips(document.body)[1]);
		expect(chips(document.body).map(chip => chip.tabIndex)).toEqual([-1, 0, -1, -1]);

		fireEvent.keyDown(chips(document.body)[1], { key: 'ArrowLeft' });
		fireEvent.keyDown(chips(document.body)[0], { key: 'ArrowLeft' });
		expect(document.activeElement).toBe(chips(document.body)[3]);

		fireEvent.keyDown(chips(document.body)[3], { key: 'ArrowRight' });
		expect(document.activeElement).toBe(chips(document.body)[0]);
	});

	it('pins itself against the viewport’s last pixel, reading the newest of a batched delivery', () => {
		const { container } = mount();
		const root = container.querySelector<HTMLElement>('[data-testid="rotation-floating-action-bar-root"]')!;
		Object.defineProperty(root, 'clientHeight', { value: 44, configurable: true });
		expect(observed[0].options).toMatchObject({ rootMargin: '0px 0px -1px 0px', threshold: [0, 1] });

		// One delivery, oldest first: reading the first record would leave the bar unpinned.
		act(() => observed[0].callback([{ intersectionRatio: 1 }, { intersectionRatio: 0.5 }] as Array<IntersectionObserverEntry>, {} as IntersectionObserver));
		expect(root.hasAttribute('data-stuck')).toBe(true);

		act(() => observed[0].callback([{ intersectionRatio: 0.5 }, { intersectionRatio: 1 }] as Array<IntersectionObserverEntry>, {} as IntersectionObserver));
		expect(root.hasAttribute('data-stuck')).toBe(false);
	});
});
