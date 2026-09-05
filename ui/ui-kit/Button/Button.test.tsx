import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
	it('is a non-submitting button by default', () => {
		render(<Button>Simulate</Button>);
		const button = screen.getByRole('button', { name: 'Simulate' });
		// The tree has several <button>s inside forms with no type, which submit on click.
		expect(button.getAttribute('type')).toBe('button');
		expect(button.className).toBe('btn btn-primary');
	});

	it('renders an anchor when asked, keeping the button classes', () => {
		render(
			<Button as="a" href="https://wowhead.com/mop-classic/item=1" variant="link">
				Item
			</Button>,
		);
		const link = screen.getByRole('link', { name: 'Item' });
		expect(link.getAttribute('href')).toBe('https://wowhead.com/mop-classic/item=1');
		expect(link.className).toBe('btn btn-link');
		expect(link.getAttribute('type')).toBeNull();
	});

	it('adds the size and caller classes without dropping the variant', () => {
		render(
			<Button variant="outline-primary" size="sm" className="reforge-action">
				Optimize
			</Button>,
		);
		expect(screen.getByRole('button').className).toBe('btn btn-outline-primary btn-sm reforge-action');
	});
});
