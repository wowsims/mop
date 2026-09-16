import { Spec } from '@generated/proto/common';
import type { Database } from '@sim/proto/database';
import { render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { ITEM_NOTICES, MISSING_RANDOM_SUFFIX_WARNING, registerSetBonusNotices, SET_BONUS_NOTICES } from './item_notices';

const markup = (itemId: number, spec: Spec = Spec.SpecUnknown) => renderToStaticMarkup(ITEM_NOTICES.get(itemId)?.[spec]);
const noticeContainer = (itemId: number, spec: Spec = Spec.SpecUnknown) => render(<>{ITEM_NOTICES.get(itemId)?.[spec]}</>).container;

describe('the item notice table', () => {
	it('renders the tentative-implementation notice', () => {
		const container = noticeContainer(95346);
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p', 'p']);
		const paragraphs = container.querySelectorAll('p');
		expect(paragraphs[0].textContent).toBe('This item is implemented, but detailed proc behavior will be confirmed on PTR.');
		expect(paragraphs[0].querySelectorAll('span')).toHaveLength(1);
		expect(paragraphs[0].querySelector('span')!.className).toBe('font-bold');
		expect(paragraphs[0].querySelector('span')!.textContent).toBe('is');
		expect(paragraphs[1].className).toBe('mb-0');
		expect(paragraphs[1].textContent).toBe('Want to help out by providing additional information? Contact us on our Discord!');
	});

	it('lists the tooltips a missing item effect carries', () => {
		const container = noticeContainer(84373);
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p', 'ul']);
		const heading = container.querySelector('p')!;
		expect(heading.className).toBe('font-bold');
		expect(heading.textContent).toBe('The following item effect (on-use or proc) is not implemented!');
		const items = container.querySelectorAll('ul > li');
		expect(items).toHaveLength(1);
		expect(items[0].textContent).toBe('Your Chains of Ice ability now generates an additional 10 Runic Power.');
	});

	it('renders the hand-written trinket notice', () => {
		const container = noticeContainer(94523);
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p']);
		const paragraphs = container.querySelectorAll('p');
		expect(paragraphs[0].textContent).toBe(
			'The Agility proc on this trinket has been implemented, but the Voodoo Gnomes are not implemented. The DPS gain of these is around ~40 DPS.',
		);
		expect(paragraphs[0].querySelectorAll('span')).toHaveLength(1);
		expect(paragraphs[0].querySelector('span')!.className).toBe('font-bold');
		expect(paragraphs[0].querySelector('span')!.textContent).toBe('not');
	});

	it('renders the random suffix warning', () => {
		const container = render(<>{MISSING_RANDOM_SUFFIX_WARNING}</>).container;
		expect([...container.children].map(child => child.tagName.toLowerCase())).toEqual(['p']);
		const p = container.querySelector('p')!;
		expect(p.className).toBe('mb-0');
		expect(p.textContent).toBe('Please select a random suffix');
	});
});

describe('registerSetBonusNotices', () => {
	const SET_ID = 9999;
	const ITEM_IDS = [90001, 90002];

	afterEach(() => {
		SET_BONUS_NOTICES.delete(SET_ID);
		ITEM_IDS.forEach(id => ITEM_NOTICES.delete(id));
	});

	// The set-bonus notices are written into the same map the pickers read at runtime, which is why
	// there is one table rather than a second copy.
	it('writes a notice into the shared table for every item in the set', () => {
		SET_BONUS_NOTICES.set(SET_ID, null);
		registerSetBonusNotices({ getItemIdsForSet: (setId: number) => (setId === SET_ID ? ITEM_IDS : []) } as unknown as Database);

		for (const id of ITEM_IDS) {
			expect(markup(id)).toBe(
				'<p class="mb-1"> This item set has the following warnings:</p>' +
					'<ul class="mb-0"><li>2-piece: Not yet implemented</li><li>4-piece: Not yet implemented</li></ul>',
			);
		}
	});
});
