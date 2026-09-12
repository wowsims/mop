import '@i18n/config';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LocaleHtml } from './LocaleHtml';

const html = (markup: string) => render(<LocaleHtml html={markup} />).container.innerHTML;

describe('LocaleHtml', () => {
	it('renders a locale tag as a real element carrying its own attributes', () => {
		expect(html('<span className="bold">Batch</span> plain')).toBe('<span class="bold">Batch</span> plain');
	});

	it('keeps void and repeated tags apart', () => {
		expect(html('<span className="bold">a</span><br /><span className="text-brand">b</span>')).toBe(
			'<span class="bold">a</span><br><span class="text-brand">b</span>',
		);
	});

	it('renders anchors with href and target', () => {
		expect(html('<a href="https://raidbots.com" target="_blank" rel="noopener noreferrer">R</a>')).toBe(
			'<a href="https://raidbots.com" target="_blank" rel="noopener noreferrer">R</a>',
		);
	});

	it('renders nested block markup', () => {
		expect(html('<p>one</p><ul><li>two</li></ul>')).toBe('<p>one</p><ul><li>two</li></ul>');
	});

	it('leaves a separator-bearing sentence intact', () => {
		expect(html('Stats: haste. Then <span className="bold">more</span>')).toBe('Stats: haste. Then <span class="bold">more</span>');
	});
});
