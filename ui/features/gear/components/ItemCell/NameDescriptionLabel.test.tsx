import { render } from '@testing-library/react';
import type { ClassValue } from 'clsx';
import { describe, expect, it } from 'vitest';

import { NameDescriptionLabel } from './NameDescriptionLabel';

describe('NameDescriptionLabel', () => {
	for (const nameDescription of ['Heroic', 'Raid Finder', 'Heroic Thunderforged', '']) {
		it(`wraps "${nameDescription}" in parentheses`, () => {
			const { container } = render(<NameDescriptionLabel nameDescription={nameDescription} />);
			expect(container.firstElementChild!.outerHTML).toBe(`<small class="heroic-label">(${nameDescription})</small>`);
		});
	}

	it('appends className after the base class', () => {
		const className: ClassValue = ['extra-a', { 'extra-b': true, 'extra-c': false }];
		const { container } = render(<NameDescriptionLabel nameDescription="Heroic" className={className} />);
		expect(container.firstElementChild!.getAttribute('class')).toBe('heroic-label extra-a extra-b');
	});
});
