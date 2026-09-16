import { ItemType } from '@generated/proto/common';
import { type UIItem, UIItem_FactionRestriction } from '@generated/proto/ui';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { HREF } = vi.hoisted(() => ({ HREF: 'https://www.wowhead.com/mop-classic/item=1' }));

vi.mock('@ui-kit/hooks/useActionId', () => ({
	useActionId: () => ({ iconUrl: 'icon.jpg', name: 'Item', href: HREF, ready: true }),
}));

import { BulkItemSearchRow } from './BulkItemSearchRow';

const item = () =>
	({
		id: 1,
		name: 'Item',
		quality: 4,
		ilvl: 500,
		type: ItemType.ItemTypeHead,
		nameDescription: '',
		factionRestriction: UIItem_FactionRestriction.UNSPECIFIED,
	}) as unknown as UIItem;

const anchor = (container: HTMLElement) => container.querySelector<HTMLAnchorElement>('a[data-item-id]')!;

describe('BulkItemSearchRow', () => {
	it('keeps the row out of the tab order, since it is the whole content of a role="option"', () => {
		const { container } = render(<BulkItemSearchRow item={item()} />);

		expect(anchor(container).getAttribute('tabindex')).toBe('-1');
	});

	it("still carries the wowhead href, the row's only tooltip attachment", () => {
		const { container } = render(<BulkItemSearchRow item={item()} />);

		expect(anchor(container).getAttribute('href')).toBe(HREF);
		expect(anchor(container).getAttribute('target')).toBe('_blank');
	});
});
