import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ItemCell } from './ItemCell';

const shape = (root: Element): string[] => [
	`${root.tagName.toLowerCase()}[${root.getAttribute('data-testid') ?? ''}]`,
	...[...root.children].flatMap(child => shape(child).map(line => '  ' + line)),
];

describe('ItemCell', () => {
	it('fixes the class vocabulary and the nesting order', () => {
		const { container } = render(
			<ItemCell
				icon={<a className="test-icon" />}
				ilvl="463"
				sockets={<a className="test-gem" />}
				name={<a className="test-name" />}
				labels={<a className="test-enchant" />}
			/>,
		);

		expect(shape(container.firstElementChild!)).toEqual([
			'div[item-picker-root]',
			'  div[item-picker-icon-wrapper]',
			'    span[item-picker-ilvl]',
			'    a[]',
			'    div[item-picker-sockets-container]',
			'      a[]',
			'  div[item-picker-labels-container]',
			'    div[item-picker-name-row]',
			'      a[]',
			'    a[]',
		]);
	});

	it('keeps an empty item-level badge and an empty sockets container, which an empty gear slot renders', () => {
		const { container } = render(<ItemCell icon={<a />} ilvl={null} sockets={null} name="Head" />);

		expect(container.querySelector('[data-testid="item-picker-ilvl"]')?.textContent).toBe('');
		expect(container.querySelector('[data-testid="item-picker-sockets-container"]')?.children).toHaveLength(0);
	});

	it('drops the badge and the sockets container when the caller omits them', () => {
		const { container } = render(<ItemCell icon={<a />} name="Head" />);

		expect(container.querySelector('[data-testid="item-picker-ilvl"]')).toBeNull();
		expect(container.querySelector('[data-testid="item-picker-sockets-container"]')).toBeNull();
	});

	it('puts the trailing action after the labels, outside the label stack', () => {
		const { container } = render(<ItemCell icon={<a />} name="Head" labels={<a className="test-reforge" />} action={<button className="favourite" />} />);

		const root = container.firstElementChild!;
		expect(root.lastElementChild?.classList.contains('favourite')).toBe(true);
		expect(root.querySelector('[data-testid="item-picker-labels-container"] .favourite')).toBeNull();
	});
});
