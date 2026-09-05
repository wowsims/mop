import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

const Anchored = ({ content = 'Reforge to hit cap' }: { content?: string }) => (
	<>
		<button data-tooltip-id="t1">anchor</button>
		<Tooltip id="t1" content={content} />
	</>
);

describe('Tooltip', () => {
	it('shows its content when the anchor is hovered', async () => {
		render(<Anchored />);
		fireEvent.mouseEnter(screen.getByRole('button'));
		expect(await screen.findByText('Reforge to hit cap')).toBeTruthy();
	});

	// 61 tippy() calls in the tree have 27 destroy()s. Unmount cleanup is the reason to move.
	it('leaves nothing behind when unmounted while open', async () => {
		const { unmount } = render(<Anchored />);
		fireEvent.mouseEnter(screen.getByRole('button'));
		await screen.findByText('Reforge to hit cap');

		unmount();
		expect(document.querySelectorAll('.sim-tooltip')).toHaveLength(0);
		expect(document.body.textContent).not.toContain('Reforge to hit cap');
	});

	// The library injects its own stylesheet unless disableStyleInjection is "core" — bare `true`
	// stops only the base styles. An injected tag lands after the bundle's <link> and outranks the
	// component's theme, which is how the tooltip kept the library's 0.9 opacity in the browser.
	it('injects no stylesheet of its own', async () => {
		render(<Anchored />);
		fireEvent.mouseEnter(screen.getByRole('button'));
		await screen.findByText('Reforge to hit cap');
		expect(document.querySelectorAll('style[id^="react-tooltip-"]')).toHaveLength(0);
	});
});
