import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NameDisplay } from './NameDisplay';

describe('NameDisplay', () => {
	it('renders the name', () => {
		render(<NameDisplay name="My Group" onRename={() => {}} />);

		expect(screen.getByText('My Group')).not.toBeNull();
	});

	it('calls onRename when the rename button is clicked', () => {
		const onRename = vi.fn();
		render(<NameDisplay name="My Group" onRename={onRename} />);

		fireEvent.click(screen.getByRole('button'));
		expect(onRename).toHaveBeenCalledTimes(1);
	});

	it('renders the pencil icon as fas fa-pencil-alt', () => {
		render(<NameDisplay name="My Group" onRename={() => {}} />);

		const icon = screen.getByRole('button').querySelector('i');
		expect(icon?.classList.contains('fas')).toBe(true);
		expect(icon?.classList.contains('fa-pencil-alt')).toBe(true);
	});
});
