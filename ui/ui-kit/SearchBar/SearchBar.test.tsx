import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchBar } from './SearchBar';

const input = () => screen.getByRole('textbox') as HTMLInputElement;

describe('SearchBar', () => {
	it('calls onChange immediately on every keystroke when undebounced', () => {
		const onChange = vi.fn();
		render(<SearchBar value="" onChange={onChange} />);
		fireEvent.change(input(), { target: { value: 'a' } });
		expect(onChange).toHaveBeenCalledWith('a');
		fireEvent.change(input(), { target: { value: 'ab' } });
		expect(onChange).toHaveBeenLastCalledWith('ab');
	});

	it('re-syncs the field when the value prop changes externally', () => {
		const { rerender } = render(<SearchBar value="abc" onChange={vi.fn()} />);
		expect(input().value).toBe('abc');
		rerender(<SearchBar value="xyz" onChange={vi.fn()} />);
		expect(input().value).toBe('xyz');
	});

	it('renders a label only when one is given', () => {
		const { rerender } = render(<SearchBar value="" onChange={vi.fn()} />);
		expect(screen.queryByText('Custom Label')).toBeNull();
		rerender(<SearchBar value="" onChange={vi.fn()} label="Custom Label" id="the-id" />);
		expect(screen.getByText('Custom Label').closest('label')!.getAttribute('for')).toBe('the-id');
	});

	it('does not render a clear button unless clearable is set', () => {
		render(<SearchBar value="abc" onChange={vi.fn()} />);
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('shows a clear button once there is text, and clearing it calls onChange with an empty string', () => {
		const onChange = vi.fn();
		render(<SearchBar value="" onChange={onChange} clearable clearLabel="Clear" />);
		expect(screen.queryByRole('button', { name: 'Clear', hidden: true })).toBeNull();

		fireEvent.change(input(), { target: { value: 'abc' } });
		const clearButton = screen.getByRole('button', { name: 'Clear' });
		fireEvent.click(clearButton);
		expect(onChange).toHaveBeenLastCalledWith('');
		expect(input().value).toBe('');
	});

	describe('debounced', () => {
		beforeEach(() => vi.useFakeTimers());
		afterEach(() => vi.useRealTimers());

		it('holds the field responsive but delays onChange until the debounce window elapses', () => {
			const onChange = vi.fn();
			render(<SearchBar value="" onChange={onChange} debounceMs={150} />);

			fireEvent.change(input(), { target: { value: 'a' } });
			expect(input().value).toBe('a');
			expect(onChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(149);
			expect(onChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(1);
			expect(onChange).toHaveBeenCalledWith('a');
		});

		it('resets the debounce window on every keystroke rather than firing once per elapsed window', () => {
			const onChange = vi.fn();
			render(<SearchBar value="" onChange={onChange} debounceMs={150} />);

			fireEvent.change(input(), { target: { value: 'a' } });
			vi.advanceTimersByTime(100);
			fireEvent.change(input(), { target: { value: 'ab' } });
			vi.advanceTimersByTime(100);
			expect(onChange).not.toHaveBeenCalled();

			vi.advanceTimersByTime(50);
			expect(onChange).toHaveBeenCalledTimes(1);
			expect(onChange).toHaveBeenCalledWith('ab');
		});
	});

	it('renders a bare form-control input carrying any extra className, inside an input-root', () => {
		const { container } = render(<SearchBar value="" onChange={vi.fn()} className="selector-modal-search" placeholder="Search" />);
		const root = container.firstElementChild!;
		expect(root.classList.contains('input-root')).toBe(true);
		expect(input().className.split(' ')).toEqual(expect.arrayContaining(['form-control', 'selector-modal-search']));
		expect(input().placeholder).toBe('Search');
	});
});
