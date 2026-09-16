import { render } from '@testing-library/react';
import type { ClassValue } from 'clsx';
import { describe, expect, it } from 'vitest';

import { NameDescriptionLabel } from './NameDescriptionLabel';

describe('NameDescriptionLabel', () => {
	for (const nameDescription of ['Heroic', 'Raid Finder', 'Heroic Thunderforged', '']) {
		it(`wraps "${nameDescription}" in parentheses`, () => {
			const { container } = render(<NameDescriptionLabel nameDescription={nameDescription} />);
			const label = container.firstElementChild!;

			expect(label.tagName).toBe('SMALL');
			expect(label.getAttribute('data-testid')).toBe('heroic-label');
			expect(label.textContent).toBe(`(${nameDescription})`);
			expect(label.classList.contains('text-quality-uncommon')).toBe(true);
		});
	}

	it('appends className after the base classes', () => {
		const className: ClassValue = ['extra-a', { 'extra-b': true, 'extra-c': false }];
		const { container } = render(<NameDescriptionLabel nameDescription="Heroic" className={className} />);
		const classes = [...container.firstElementChild!.classList];

		expect(classes.slice(-2)).toEqual(['extra-a', 'extra-b']);
		expect(classes).not.toContain('extra-c');
		expect(classes.indexOf('text-quality-uncommon')).toBeLessThan(classes.indexOf('extra-a'));
	});

	it('drops the left margin when it is flush', () => {
		const spaced = render(<NameDescriptionLabel nameDescription="Heroic" />).container.firstElementChild!;
		expect([...spaced.classList]).toEqual(expect.arrayContaining(['ml-1']));
		expect(spaced.classList.contains('ml-0')).toBe(false);

		const flush = render(<NameDescriptionLabel nameDescription="Heroic" flush />).container.firstElementChild!;
		expect([...flush.classList]).toEqual(expect.arrayContaining(['ml-0']));
		expect(flush.classList.contains('ml-1')).toBe(false);
	});
});
