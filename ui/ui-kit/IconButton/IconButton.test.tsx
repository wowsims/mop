import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IconButton } from './IconButton';

describe('IconButton', () => {
	it('sets aria-label from label and defaults to no tone class', () => {
		render(<IconButton label="Close" />);
		const button = screen.getByRole('button', { name: 'Close' });
		expect(button.className).not.toMatch(/text-link/);
	});

	it('applies the tone utility class', () => {
		render(<IconButton label="Delete" tone="danger" />);
		expect(screen.getByRole('button', { name: 'Delete' }).className).toContain('text-link-danger');
	});

	it('forwards the ref to the button element', () => {
		const ref = createRef<HTMLButtonElement>();
		render(<IconButton label="Close" ref={ref} />);
		expect(ref.current).toBeInstanceOf(HTMLButtonElement);
	});

	it('fires onClick', () => {
		const onClick = vi.fn();
		render(<IconButton label="Close" onClick={onClick} />);
		fireEvent.click(screen.getByRole('button', { name: 'Close' }));
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it('forwards disabled', () => {
		render(<IconButton label="Close" disabled />);
		expect(screen.getByRole('button', { name: 'Close' })).toHaveProperty('disabled', true);
	});
});
