import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Chip } from './Chip';

describe('Chip', () => {
	it('renders the label', () => {
		const { getByTestId } = render(<Chip label="Loadout 1" />);
		expect(getByTestId('saved-data-set-name').textContent).toBe('Loadout 1');
	});

	it('sets data-active when active', () => {
		const { getByTestId, rerender } = render(<Chip label="Loadout 1" active={false} />);
		expect(getByTestId('saved-data-set-chip').hasAttribute('data-active')).toBe(false);

		rerender(<Chip label="Loadout 1" active />);
		expect(getByTestId('saved-data-set-chip').getAttribute('data-active')).toBe('');
	});

	it('sets data-disabled when disabled', () => {
		const { getByTestId } = render(<Chip label="Loadout 1" disabled />);
		expect(getByTestId('saved-data-set-chip').getAttribute('data-disabled')).toBe('');
	});

	it('calls onSelect when the name is clicked', () => {
		const onSelect = vi.fn();
		const { getByTestId } = render(<Chip label="Loadout 1" onSelect={onSelect} />);
		fireEvent.click(getByTestId('saved-data-set-name'));
		expect(onSelect).toHaveBeenCalledTimes(1);
	});

	it('omits the delete trigger when onDelete is not given', () => {
		const { queryByTestId } = render(<Chip label="Loadout 1" />);
		expect(queryByTestId('saved-data-set-delete')).toBeNull();
	});

	it('does not call onDelete until the confirm popover is confirmed', () => {
		const onDelete = vi.fn();
		const { getByTestId } = render(<Chip label="Loadout 1" onDelete={onDelete} deleteConfirmLabel="Delete" />);
		fireEvent.click(getByTestId('saved-data-set-delete'));
		expect(onDelete).not.toHaveBeenCalled();

		const [, confirm] = document.querySelectorAll<HTMLButtonElement>('[data-testid="sim-confirm-popover-actions"] button');
		fireEvent.click(confirm);
		expect(onDelete).toHaveBeenCalledTimes(1);
	});

	it('calls onDelete immediately when confirmDelete is false', () => {
		const onDelete = vi.fn();
		const { getByTestId } = render(<Chip label="Loadout 1" onDelete={onDelete} confirmDelete={false} />);
		const deleteButton = getByTestId('saved-data-set-delete');
		expect(deleteButton.className).toContain('ui-chip-delete');
		fireEvent.click(deleteButton);
		expect(onDelete).toHaveBeenCalledTimes(1);
	});
});
