import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Spinner } from './Spinner';

describe('Spinner', () => {
	it('renders a div with the loader class and the md fallback size by default', () => {
		const { container } = render(<Spinner />);
		const el = container.firstElementChild as HTMLElement;
		expect(el.tagName).toBe('DIV');
		expect(el.getAttribute('data-testid')).toBe('loader');
		expect(el.className).toContain('loader');
		expect(el.className).toContain('animate-spin');
		expect(el.className).toContain('w-(--loader-width,120px)');
	});

	it('applies the sm fallback size', () => {
		const { container } = render(<Spinner size="sm" />);
		expect((container.firstElementChild as HTMLElement).className).toContain('w-(--loader-width,60px)');
	});

	it('applies additive className', () => {
		const { container } = render(<Spinner className="extra" />);
		expect((container.firstElementChild as HTMLElement).className).toContain('extra');
	});
});
