import { Spec } from '@generated/proto/common';
import type { Player } from '@sim/player/player';
import { render } from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it } from 'vitest';

import { ItemNotice } from './item_notice';

const player = { getSpec: () => Spec.SpecUnknown } as unknown as Player<any>;

// 95346 is one of the tentative-implementation items in the notice table.
const NOTICED_ITEM = 95346;

const shownText = (notice: ItemNotice) => {
	notice.tooltip!.show();
	return notice.tooltip!.popper.textContent ?? '';
};

describe('ItemNotice', () => {
	it('renders no icon for an item with no notice', () => {
		const notice = new ItemNotice(player, { itemId: 1 });

		expect(notice.hasNotice).toBe(false);
		expect(notice.rootElem.children).toHaveLength(0);
	});

	it('fills the tooltip with the item notice when it is shown', () => {
		const notice = new ItemNotice(player, { itemId: NOTICED_ITEM });

		expect(notice.rootElem.querySelector('button.fa-exclamation-triangle')).toBeTruthy();
		expect(shownText(notice)).toContain('detailed proc behavior will be confirmed on PTR');
	});

	it('appends the additional notice after the item notice', () => {
		const notice = new ItemNotice(player, { itemId: NOTICED_ITEM, additionalNoticeData: <p>Please select a random suffix</p> });

		const text = shownText(notice);
		expect(text).toContain('detailed proc behavior will be confirmed on PTR');
		expect(text.indexOf('Please select a random suffix')).toBeGreaterThan(text.indexOf('confirmed on PTR'));
	});

	// The defect the lazy build exists for: the notices are React, and React defers a render started
	// inside a commit. A bulk item picker builds its `ItemRenderer` — and so this notice — from an
	// effect, where an eager `noticeElement` produced an empty fragment and logged nothing in
	// production. Building it in tippy's `onShow` moves the render into an event.
	it('fills the tooltip even when it was constructed inside a React commit', () => {
		const built: ItemNotice[] = [];
		const Host = () => {
			useLayoutEffect(() => {
				built.push(new ItemNotice(player, { itemId: NOTICED_ITEM }));
			}, []);
			return null;
		};
		render(<Host />);

		expect(built).toHaveLength(1);
		expect(shownText(built[0])).toContain('detailed proc behavior will be confirmed on PTR');
	});
});
