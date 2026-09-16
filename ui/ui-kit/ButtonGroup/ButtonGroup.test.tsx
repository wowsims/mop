import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ButtonGroup } from './ButtonGroup';

describe('ButtonGroup', () => {
	it('renders a group role carrying the caller classes and no layout classes of its own', () => {
		render(
			<ButtonGroup className="mt-2">
				<button type="button">One</button>
				<button type="button">Two</button>
			</ButtonGroup>,
		);
		const group = screen.getByRole('group');
		expect(Array.from(group.classList).sort()).toEqual(['mt-2']);
	});

	it('accepts a size hint as a data attribute, with no CSS of its own to reproduce', () => {
		render(<ButtonGroup size="sm" data-testid="group" />);
		expect(screen.getByTestId('group').getAttribute('data-size')).toBe('sm');
	});

	it('lets a caller override the role', () => {
		render(<ButtonGroup role="toolbar" data-testid="group" />);
		expect(screen.getByTestId('group').getAttribute('role')).toBe('toolbar');
	});
});
