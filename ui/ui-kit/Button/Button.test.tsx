import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
	it('is a non-submitting button by default', () => {
		render(<Button>Simulate</Button>);
		const button = screen.getByRole('button', { name: 'Simulate' });
		// The tree has several <button>s inside forms with no type, which submit on click.
		expect(button.getAttribute('type')).toBe('button');
		expect(button.className).toBe('ui-button ui-button-primary ui-button-md');
	});

	it('renders an anchor when asked, keeping the button classes', () => {
		render(
			<Button as="a" href="https://wowhead.com/mop-classic/item=1" variant="link">
				Item
			</Button>,
		);
		const link = screen.getByRole('link', { name: 'Item' });
		expect(link.getAttribute('href')).toBe('https://wowhead.com/mop-classic/item=1');
		expect(link.className).toBe('ui-button-link');
		expect(link.getAttribute('type')).toBeNull();
	});

	it('renders a label when asked, for a peer-checked radio', () => {
		render(
			<Button as="label" htmlFor="chart-view-rotation" variant="outline-primary">
				Rotation
			</Button>,
		);
		const label = screen.getByText('Rotation');
		expect(label.tagName).toBe('LABEL');
		expect(label.getAttribute('for')).toBe('chart-view-rotation');
		expect(label.className).toBe('ui-button ui-button-outline-primary ui-button-md');
	});

	it('adds the size and caller classes without dropping the variant', () => {
		render(
			<Button variant="outline-primary" size="sm" className="reforge-action">
				Optimize
			</Button>,
		);
		expect(screen.getByRole('button').className).toBe('ui-button ui-button-outline-primary ui-button-sm reforge-action');
	});

	it('applies no padding for size="none", leaving the caller to supply its own', () => {
		render(
			<Button variant="outline-primary" size="none" className="reforge-action">
				Optimize
			</Button>,
		);
		expect(screen.getByRole('button').className).toBe('ui-button ui-button-outline-primary reforge-action');
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

	it('emits the bare base bundle when variant is null, with no colour of its own', () => {
		render(
			<Button variant={null} className="talent-tree-reset link-danger text-link-danger">
				Reset
			</Button>,
		);
		expect(Array.from(screen.getByRole('button').classList).sort()).toEqual(
			['ui-button', 'ui-button-md', 'talent-tree-reset', 'link-danger', 'text-link-danger'].sort(),
		);
	});

	it('emits nothing of its own for the unstyled variant', () => {
		render(
			<Button variant="unstyled" className="delete-cooldown link-danger">
				Delete
			</Button>,
		);
		expect(screen.getByRole('button').className).toBe('delete-cooldown link-danger');
	});

	it('emits the .btn-reset look for link-danger', () => {
		render(<Button variant="link-danger">Reset</Button>);
		expect(screen.getByRole('button').className).toBe('ui-button-link ui-button-link-danger');
	});

	it('ignores size for a link variant: the legacy [class*=btn-link] rule always zeroed its padding', () => {
		render(
			<Button variant="link-danger" size="sm">
				Reset
			</Button>,
		);
		expect(screen.getByRole('button').className).toBe('ui-button-link ui-button-link-danger');
	});

	it('is chromeless for iconOnly, with no variant of its own', () => {
		render(
			<Button iconOnly aria-label="Close">
				×
			</Button>,
		);
		const button = screen.getByRole('button', { name: 'Close' });
		expect(button.className).toBe('ui-button-icon');
	});

	it('applies a colour variant to an iconOnly button, still chromeless', () => {
		render(
			<Button iconOnly variant="link-danger" aria-label="Delete">
				×
			</Button>,
		);
		expect(screen.getByRole('button', { name: 'Delete' }).className).toBe('ui-button-icon ui-button-link-danger');
	});
});
