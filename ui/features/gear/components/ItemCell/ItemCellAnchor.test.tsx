import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ItemCellAnchor } from './ItemCellAnchor';

const anchor = (container: HTMLElement) => container.querySelector('a')!;

describe('ItemCellAnchor', () => {
	// An `<a href>` is a link: Enter activates it, Space scrolls the page, and it still offers
	// middle-click and "open in new tab". `role="button"` promised a Space activation that never
	// worked, so it is dropped rather than faked.
	it('drops role=button when it has an href, whatever the caller passed', () => {
		const { container } = render(
			<ItemCellAnchor href="https://wowhead.test/item=1" role="button" onActivate={() => {}}>
				Item
			</ItemCellAnchor>,
		);

		expect(anchor(container).getAttribute('role')).toBeNull();
		expect(anchor(container).getAttribute('href')).toBe('https://wowhead.test/item=1');
	});

	// The hrefless anchor is the one that really behaves as a button: it takes focus and wires its
	// own keys, so the role describes it accurately.
	it('keeps role=button on an anchor with no href, and activates on Space', () => {
		const onActivate = vi.fn();
		const { container } = render(
			<ItemCellAnchor role="button" onActivate={onActivate}>
				Empty
			</ItemCellAnchor>,
		);

		expect(anchor(container).getAttribute('role')).toBe('button');
		expect(anchor(container).tabIndex).toBe(0);

		fireEvent.keyDown(anchor(container), { key: ' ' });
		expect(onActivate).toHaveBeenCalledTimes(1);
	});
});
