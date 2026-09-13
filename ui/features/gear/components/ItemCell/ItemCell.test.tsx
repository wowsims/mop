import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ItemCell } from './ItemCell';

const shape = (root: Element): string[] => [
	`${root.tagName.toLowerCase()}.${[...root.classList].sort().join('.')}`,
	...[...root.children].flatMap(child => shape(child).map(line => '  ' + line)),
];

describe('ItemCell', () => {
	it('fixes the class vocabulary and the nesting order', () => {
		const { container } = render(
			<ItemCell
				icon={<a className="item-picker-icon" />}
				ilvl="463"
				sockets={<a className="gem-socket-container" />}
				name={<a className="item-picker-name-container" />}
				labels={<a className="item-picker-enchant" />}
			/>,
		);

		expect(shape(container.firstElementChild!)).toEqual([
			'div.item-picker-root',
			'  div.item-picker-icon-wrapper',
			'    span.item-picker-ilvl',
			'    a.item-picker-icon',
			'    div.item-picker-sockets-container',
			'      a.gem-socket-container',
			'  div.item-picker-labels-container',
			'    div.d-flex.gap-1.item-picker-name-row',
			'      a.item-picker-name-container',
			'    a.item-picker-enchant',
		]);
	});

	it('keeps an empty item-level badge and an empty sockets container, which an empty gear slot renders', () => {
		const { container } = render(<ItemCell icon={<a />} ilvl={null} sockets={null} name="Head" />);

		expect(container.querySelector('.item-picker-ilvl')?.textContent).toBe('');
		expect(container.querySelector('.item-picker-sockets-container')?.children).toHaveLength(0);
	});

	it('drops the badge and the sockets container when the caller omits them', () => {
		const { container } = render(<ItemCell icon={<a />} name="Head" />);

		expect(container.querySelector('.item-picker-ilvl')).toBeNull();
		expect(container.querySelector('.item-picker-sockets-container')).toBeNull();
	});

	it('puts the trailing action after the labels, outside the label stack', () => {
		const { container } = render(
			<ItemCell icon={<a />} name="Head" labels={<a className="item-picker-reforge" />} action={<button className="favourite" />} />,
		);

		const root = container.firstElementChild!;
		expect(root.lastElementChild?.className).toBe('favourite');
		expect(root.querySelector('.item-picker-labels-container .favourite')).toBeNull();
	});
});
