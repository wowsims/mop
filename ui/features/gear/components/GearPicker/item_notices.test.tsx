import { Spec } from '@generated/proto/common';
import type { Database } from '@sim/proto/database';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it } from 'vitest';

import { noticeElement } from '../../view/item_notices';
import { ITEM_NOTICES, MISSING_RANDOM_SUFFIX_WARNING, registerSetBonusNotices, SET_BONUS_NOTICES } from './item_notices';

const markup = (itemId: number, spec: Spec = Spec.SpecUnknown) => renderToStaticMarkup(ITEM_NOTICES.get(itemId)?.[spec]);

describe('the item notice table', () => {
	it('renders the tentative-implementation notice', () => {
		expect(markup(95346)).toBe(
			'<p>This item <span class="fw-bold">is</span> implemented, but detailed proc behavior will be confirmed on PTR.</p>' +
				'<p class="mb-0">Want to help out by providing additional information? Contact us on our Discord!</p>',
		);
	});

	it('lists the tooltips a missing item effect carries', () => {
		expect(markup(84373)).toBe(
			'<p class="fw-bold">The following item effect (on-use or proc) is not implemented!</p>' +
				'<ul><li>Your Chains of Ice ability now generates an additional 10 Runic Power.</li></ul>',
		);
	});

	it('renders the hand-written trinket notice', () => {
		expect(markup(94523)).toBe(
			'<p>The Agility proc on this trinket has been implemented, but the Voodoo Gnomes are <span class="fw-bold">not</span> implemented. ' +
				'The DPS gain of these is around ~40 DPS.</p>',
		);
	});

	it('renders the random suffix warning', () => {
		expect(renderToStaticMarkup(MISSING_RANDOM_SUFFIX_WARNING)).toBe('<p class="mb-0">Please select a random suffix</p>');
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
	// there is one table and the vanilla side derives DOM from it rather than holding a second copy.
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

describe('noticeElement', () => {
	it('gives the vanilla side the same markup, with no wrapper element', () => {
		const fragment = noticeElement(ITEM_NOTICES.get(95346)?.[Spec.SpecUnknown]);

		expect(fragment).toBeInstanceOf(DocumentFragment);
		expect([...fragment.children].map(child => child.tagName)).toEqual(['P', 'P']);
		expect([...fragment.children].map(child => child.outerHTML).join('')).toBe(markup(95346));
	});

	it('concatenates several notices in order', () => {
		const fragment = noticeElement(ITEM_NOTICES.get(95346)?.[Spec.SpecUnknown], MISSING_RANDOM_SUFFIX_WARNING);

		expect([...fragment.children].map(child => child.outerHTML).join('')).toBe(markup(95346) + renderToStaticMarkup(MISSING_RANDOM_SUFFIX_WARNING));
	});
});
