import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Toolbar } from './Toolbar';
import { ToolbarButton } from './ToolbarButton';

const mount = () =>
	render(
		<Toolbar testId="test-toolbar">
			<ToolbarButton testId="first">First</ToolbarButton>
			<ToolbarButton testId="second">Second</ToolbarButton>
		</Toolbar>,
	);

describe('Toolbar', () => {
	it('renders with the toolbar role', () => {
		mount();
		expect(screen.getByRole('toolbar')).toBe(screen.getByTestId('test-toolbar'));
	});

	it('moves focus between items with arrow keys', async () => {
		mount();
		screen.getByTestId('first').focus();
		expect(document.activeElement).toBe(screen.getByTestId('first'));

		fireEvent.keyDown(screen.getByTestId('first'), { key: 'ArrowRight' });
		await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('second')));
	});

	it('fires onClick on the composed Button', () => {
		const onClick = vi.fn();
		render(
			<Toolbar>
				<ToolbarButton testId="clickable" onClick={onClick}>
					Click
				</ToolbarButton>
			</Toolbar>,
		);

		fireEvent.click(screen.getByTestId('clickable'));
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});
