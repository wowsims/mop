import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
	it('renders a span with the skeleton animation', () => {
		const { container } = render(<Skeleton />);
		const el = container.firstElementChild as HTMLElement;
		expect(el.tagName).toBe('SPAN');
		expect(el.className).toContain('ui-skeleton');
	});

	it('applies additive className', () => {
		const { container } = render(<Skeleton className="extra" />);
		expect((container.firstElementChild as HTMLElement).className).toContain('extra');
	});
});
