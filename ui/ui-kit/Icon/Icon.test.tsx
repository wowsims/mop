import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Icon } from './Icon';

const el = (c: HTMLElement) => c.querySelector('i')!;

describe('Icon', () => {
	it('renders one style class and one glyph class', () => {
		const { container } = render(<Icon name="times" />);
		expect(el(container).className).toBe('fas fa-times');
	});

	it('maps a style to its family class, so `fas` and `fa-solid` cannot diverge', () => {
		expect(el(render(<Icon name="circle-question" style="regular" />).container).className).toBe('far fa-circle-question');
		expect(el(render(<Icon name="github" style="brands" />).container).className).toBe('fab fa-github');
	});

	it('resolves FontAwesome 5 aliases to the canonical name', () => {
		// Both spellings were live in the tree at once; they must now render the same glyph class.
		expect(el(render(<Icon name="exclamation-triangle" />).container).className).toContain('fa-triangle-exclamation');
		expect(el(render(<Icon name="triangle-exclamation" />).container).className).toContain('fa-triangle-exclamation');
		expect(el(render(<Icon name="question-circle" />).container).className).toContain('fa-circle-question');
		expect(el(render(<Icon name="rotate-left" />).container).className).toContain('fa-arrow-rotate-left');
	});

	it('emits exactly one glyph class', () => {
		// The toast close button carried both `fa-times` and its variant icon, leaving the rendered
		// glyph to stylesheet order.
		const classes = el(render(<Icon name="times" size="xl" spin />).container).className.split(' ');
		const glyphs = classes.filter(c => c.startsWith('fa-') && !['fa-xl', 'fa-spin'].includes(c));
		expect(glyphs).toEqual(['fa-times']);
	});

	it('adds size and spin as classes', () => {
		expect(el(render(<Icon name="spinner" size="2xl" spin />).container).className).toBe('fas fa-spinner fa-2xl fa-spin');
	});

	it('is hidden from assistive tech unless it carries a title', () => {
		expect(el(render(<Icon name="times" />).container).getAttribute('aria-hidden')).toBe('true');
		const titled = el(render(<Icon name="times" title="Close" />).container);
		expect(titled.getAttribute('aria-hidden')).toBeNull();
		expect(titled.getAttribute('title')).toBe('Close');
	});
});
