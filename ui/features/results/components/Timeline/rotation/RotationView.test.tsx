import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RotationView } from './RotationView';
import { castItem, castRow, rotationModel } from './testing';

// The row icon is `useActionId` plus `useWowheadDataset`; both are covered where they live, and
// letting them run here would put a Wowhead fetch behind every row.
vi.mock('./RotationRowIcon', () => ({ RotationRowIcon: () => <a className="rotation-row-icon" /> }));

beforeEach(() => {
	for (const name of ['ResizeObserver', 'IntersectionObserver']) {
		vi.stubGlobal(
			name,
			class {
				observe() {}
				unobserve() {}
				disconnect() {}
				takeRecords() {
					return [];
				}
			},
		);
	}
});

const MODEL = rotationModel([castRow('cast:a', 'Alpha', [castItem(0, 1), castItem(4, 5), castItem(25, 26)]), castRow('cast:b', 'Beta', [castItem(2, 3)])]);

const settle = async () => {
	await act(async () => {
		await new Promise(resolve => setTimeout(resolve, 40));
	});
};

const mount = async (model = MODEL) => {
	const view = render(<RotationView model={model} />);
	const scroller = view.container.querySelector<HTMLElement>('.rotation-scroller')!;
	// happy-dom reports every element as 0x0, and a zero-width scroller is a frame the window
	// declines to measure.
	Object.defineProperty(scroller, 'clientWidth', { value: 800, configurable: true });
	await settle();
	fireEvent.scroll(scroller);
	await settle();
	return { ...view, scroller };
};

const rowKeys = (container: HTMLElement) => [...container.querySelectorAll('.rotation-row')].map(row => row.getAttribute('data-row-key'));

describe('RotationView', () => {
	it('mounts the ordered rows between the two spacers', async () => {
		const { container } = await mount();
		expect(rowKeys(container)).toEqual(['header:player', 'cast:a', 'cast:b']);
		expect(container.querySelectorAll('.rotation-content > .rotation-vspacer')).toHaveLength(2);
	});

	it('mounts only the rows near the scrollport, and spaces out the rest of the list', async () => {
		const tall = rotationModel(Array.from({ length: 60 }, (_, index) => castRow(`cast:${index}`, `Row ${index}`, [])));
		const { container } = await mount(tall);
		// 61 rows of 32px against a 768px viewport padded by 200: rows 0..30, and 30 × 32px below.
		expect(rowKeys(container)).toHaveLength(31);
		expect(rowKeys(container).at(-1)).toBe('cast:29');
		const spacers = [...container.querySelectorAll<HTMLElement>('.rotation-content > .rotation-vspacer')];
		expect(spacers[0].style.getPropertyValue('--vspacer-h')).toBe('0');
		expect(spacers[1].style.getPropertyValue('--vspacer-h')).toBe('960');
	});

	it('mounts only the items inside the track window', async () => {
		const { container } = await mount();
		// 800px wide at the default 100 pps, padded 600 each way, is -6s..14s: the 25s cast is out.
		expect(container.querySelector('[data-row-key="cast:a"]')!.querySelectorAll('.rotation-item-cast')).toHaveLength(2);
	});

	it('keeps the content its full height through a toggle, so the page cannot clamp the scroll', async () => {
		const tall = rotationModel(Array.from({ length: 60 }, (_, index) => castRow(`cast:${index}`, `Row ${index}`, [])));
		const { container } = await mount(tall);
		const height = () => {
			const spacers = [...container.querySelectorAll<HTMLElement>('.rotation-content > .rotation-vspacer')];
			const spacing = spacers.reduce((total, spacer) => total + Number(spacer.style.getPropertyValue('--vspacer-h')), 0);
			return spacing + container.querySelectorAll('.rotation-row').length * 32;
		};
		expect(height()).toBe(61 * 32);

		// Read in the render the click causes, not after the next frame: emptying the container even
		// for one paint is what let the browser clamp scrollTop and jump the view.
		fireEvent.click(container.querySelector('[data-row-key="cast:20"] .rotation-row-hide')!);
		expect(container.querySelectorAll('.rotation-row').length).toBeGreaterThan(0);
		expect(height()).toBe(60 * 32);
	});

	it('takes a row out of the order when its eye toggle is clicked', async () => {
		const { container } = await mount();
		fireEvent.click(container.querySelector('[data-row-key="cast:a"] .rotation-row-hide')!);
		await settle();
		expect(rowKeys(container)).toEqual(['header:player', 'cast:b']);
	});

	it('drops the whole section once every row in it is hidden', async () => {
		const { container } = await mount();
		fireEvent.click(container.querySelector('[data-row-key="cast:a"] .rotation-row-hide')!);
		await settle();
		fireEvent.click(container.querySelector('[data-row-key="cast:b"] .rotation-row-hide')!);
		await settle();
		expect(rowKeys(container)).toEqual([]);
	});

	it('brings every hidden row back from the floating bar', async () => {
		const { container } = await mount();
		fireEvent.click(container.querySelector('[data-row-key="cast:a"] .rotation-row-hide')!);
		await settle();
		fireEvent.click(container.querySelector('.rotation-fab-show-all')!);
		await settle();
		expect(rowKeys(container)).toEqual(['header:player', 'cast:a', 'cast:b']);
	});

	it('opens one tooltip for the hovered item, and closes it when the pointer leaves the track', async () => {
		const { container } = await mount();
		const item = container.querySelector('[data-row-key="cast:a"] .rotation-item-cast')!;
		fireEvent.mouseOver(item);
		await settle();
		expect(container.querySelector('.timeline-hover-tooltip')!.textContent).toContain('Bolt from 0.00s');

		fireEvent.mouseOver(container.querySelector('.rotation-content')!);
		await settle();
		expect(container.querySelector('.timeline-hover-tooltip')).toBeNull();
	});

	it('renders nothing but its chrome without a model', async () => {
		const { container } = await mount(null as never);
		expect(rowKeys(container)).toEqual([]);
		expect(container.querySelector('.rotation-ruler-track')).not.toBeNull();
	});
});
