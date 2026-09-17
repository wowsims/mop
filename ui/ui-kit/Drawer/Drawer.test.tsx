import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Drawer } from './Drawer';

const mount = () =>
	render(
		<Drawer
			trigger={
				<button type="button" data-testid="trigger">
					Open
				</button>
			}
			modal={false}
			testId="popup">
			<div data-testid="content">Content</div>
		</Drawer>,
	);

describe('Drawer', () => {
	it('opens on trigger click and closes on Escape, returning focus', async () => {
		mount();
		expect(screen.queryByTestId('popup')).toBeNull();

		fireEvent.click(screen.getByTestId('trigger'));
		expect(screen.getByTestId('popup')).not.toBeNull();
		expect(screen.getByTestId('content')).not.toBeNull();

		fireEvent.keyDown(screen.getByTestId('popup'), { key: 'Escape' });

		await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('trigger')));
	});
});
