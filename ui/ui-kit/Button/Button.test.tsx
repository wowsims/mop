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

	it('adds rel to a cross-origin link without being asked', () => {
		render(
			<Button as="a" href="https://www.wowhead.com/mop-classic/item=1" target="_blank">
				Item
			</Button>,
		);
		expect(screen.getByRole('link').getAttribute('rel')).toBe('noopener noreferrer');
	});

	it('merges an explicit rel rather than replacing it, and does not duplicate', () => {
		render(
			<Button as="a" href="https://www.wowhead.com/mop-classic/item=1" rel="nofollow noopener">
				Item
			</Button>,
		);
		expect(screen.getByRole('link').getAttribute('rel')).toBe('nofollow noopener noreferrer');
	});

	// Relative links stay in this document, and the non-http schemes open no browsing context.
	it('leaves relative and non-http hrefs alone', () => {
		render(
			<>
				<Button as="a" href="/mop/warrior/arms/">
					Arms
				</Button>
				<Button as="a" href="#gear-tab">
					Gear
				</Button>
				<Button as="a" href="mailto:someone@example.com">
					Mail
				</Button>
				<Button as="a" href="javascript:void(0)">
					Inert
				</Button>
			</>,
		);
		screen.getAllByRole('link').forEach(link => expect(link.getAttribute('rel')).toBeNull());
	});

	// The talents tree's reset is `btn link-danger` — a bare btn with no variant.
	it('emits a bare btn when variant is null', () => {
		render(
			<Button variant={null} className="talent-tree-reset link-danger">
				Reset
			</Button>,
		);
		expect(Array.from(screen.getByRole('button').classList).sort()).toEqual(['btn', 'link-danger', 'talent-tree-reset']);
	});
});
