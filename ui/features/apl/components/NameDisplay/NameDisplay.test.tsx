import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NameDisplay } from './NameDisplay';

describe('NameDisplay', () => {
	it('renders the name inside .apl-name-display > .apl-name-value', () => {
		const { container } = render(<NameDisplay name="My Group" onRename={() => {}} />);

		const root = container.querySelector('.apl-name-display');
		const value = root?.querySelector('.apl-name-value');
		expect(value?.textContent).toBe('My Group');
	});

	it('calls onRename when the .apl-name-rename button is clicked', () => {
		const onRename = vi.fn();
		const { container } = render(<NameDisplay name="My Group" onRename={onRename} />);

		fireEvent.click(container.querySelector('.apl-name-rename') as HTMLButtonElement);
		expect(onRename).toHaveBeenCalledTimes(1);
	});

	it('renders the pencil icon as fas fa-pencil-alt', () => {
		const { container } = render(<NameDisplay name="My Group" onRename={() => {}} />);

		const icon = container.querySelector('.apl-name-rename i');
		expect(icon?.classList.contains('fas')).toBe(true);
		expect(icon?.classList.contains('fa-pencil-alt')).toBe(true);
	});
});
