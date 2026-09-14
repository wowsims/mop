import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from './Dialog';

describe('Dialog', () => {
	it('builds the header/body/footer stack, with the caller class on the popup', () => {
		render(
			<Dialog
				open
				onOpenChange={() => {}}
				className="advanced-encounter-picker-modal"
				size="xl"
				title="Encounter"
				footer={<button type="button">Done</button>}>
				<p>contents</p>
			</Dialog>,
		);

		const popup = screen.getByRole('dialog');
		expect(popup.classList.contains('advanced-encounter-picker-modal')).toBe(true);
		expect(popup.getAttribute('data-testid')).toBe('sim-dialog-popup');
		expect(popup.getAttribute('data-size')).toBe('xl');
		expect(Array.from(popup.children).map(el => el.getAttribute('data-testid'))).toEqual(['sim-dialog-header', 'sim-dialog-body', 'sim-dialog-footer']);
		expect(within(popup).getByTestId('sim-dialog-body').textContent).toBe('contents');
	});

	// The default portal target is `<body>`, which is outside `.sim-ui` and so outside the spec theme
	// — measured in a browser, a `.btn-primary` in a body-portaled dialog is Bootstrap's
	// rgb(13, 110, 253) while the same markup under `.sim-ui` is the warrior brown rgb(199, 156, 110).
	// `container` is how a consumer keeps the theme; that its geometry is unaffected was measured too.
	it('portals into the container it is given', () => {
		const host = document.createElement('div');
		host.className = 'sim-ui';
		document.body.appendChild(host);

		render(
			<Dialog open onOpenChange={() => {}} container={host} title="Options">
				body
			</Dialog>,
		);
		expect(host.contains(screen.getByRole('dialog'))).toBe(true);

		host.remove();
	});

	// Base UI puts the dialog role on the popup and wires `aria-labelledby` to its own `<h2>` title.
	it('names the dialog from its title', () => {
		render(
			<Dialog open onOpenChange={() => {}} title="Advanced Encounter">
				body
			</Dialog>,
		);

		const popup = screen.getByRole('dialog', { name: 'Advanced Encounter' });
		const title = screen.getByRole('heading', { name: 'Advanced Encounter' });
		expect(title.tagName).toBe('H2');
		expect(popup.getAttribute('aria-labelledby')).toBe(title.id);
	});

	it('closes on the close button and on Escape', () => {
		const onOpenChange = vi.fn();
		render(
			<Dialog open onOpenChange={onOpenChange} title="Options">
				body
			</Dialog>,
		);

		const close = screen.getByRole('button', { name: 'Close' });
		// The tree has several <button>s inside forms with no type, so this one needs `type="button"` set explicitly.
		expect(close.getAttribute('type')).toBe('button');
		expect(close.tagName).toBe('BUTTON');
		expect(close.getAttribute('aria-label')).toBe('Close');

		fireEvent.click(close);
		expect(onOpenChange).toHaveBeenCalledWith(false);

		onOpenChange.mockClear();
		fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('removes the close button and refuses Escape when preventClose is set', () => {
		const onOpenChange = vi.fn();
		render(
			<Dialog open onOpenChange={onOpenChange} preventClose title="Simulating">
				body
			</Dialog>,
		);

		expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
		fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		expect(onOpenChange).not.toHaveBeenCalled();
		expect(screen.getByRole('dialog')).toBeTruthy();
	});

	// With `preventClose` there is nothing to put in the header at all, so there is no header.
	it('drops the header bar rather than emptying it', () => {
		const { rerender } = render(
			<Dialog open onOpenChange={() => {}} header={false}>
				body
			</Dialog>,
		);
		expect(within(screen.getByRole('dialog')).getByTestId('sim-dialog-header').getAttribute('data-bare')).toBe('true');

		rerender(
			<Dialog open onOpenChange={() => {}} header={false} preventClose>
				body
			</Dialog>,
		);
		expect(within(screen.getByRole('dialog')).queryByTestId('sim-dialog-header')).toBeNull();
	});

	// Base UI makes the popup the focus target, guards it either side, and hides everything else.
	// (Which element receives focus first is layout-dependent and so is not measurable here; Base UI
	// documents it as the first tabbable element in the popup.)
	it('makes the popup the focus target and hides the rest of the document', () => {
		render(
			<Dialog open onOpenChange={() => {}} title="Options">
				<button type="button">Reset</button>
			</Dialog>,
		);

		const popup = screen.getByRole('dialog');
		expect(popup.getAttribute('tabindex')).toBe('-1');
		// Not `aria-modal`. Base UI marks the siblings instead, which is the stronger version of the same claim.
		expect(popup.getAttribute('aria-modal')).toBeNull();
		expect(popup.parentElement?.querySelectorAll('[data-base-ui-focus-guard]').length).toBe(2);

		const outside = Array.from(document.body.children).filter(el => !el.hasAttribute('data-base-ui-portal'));
		expect(outside.length).toBeGreaterThan(0);
		expect(outside.every(el => el.getAttribute('aria-hidden') === 'true')).toBe(true);
	});

	// Not assertable here: the page-scroll lock is layout-dependent, so it does not engage under
	// happy-dom at all. Measured in a real browser instead — Base UI writes `overflow: hidden` inline
	// on <body> and clears it on close.

	// Closing does not unmount at once — the popup stays in the tree carrying `data-ending-style`
	// until its transition finishes.
	it('keeps the popup mounted through the closing transition', () => {
		const { rerender } = render(
			<Dialog open onOpenChange={() => {}} title="Options">
				body
			</Dialog>,
		);
		expect(screen.getByRole('dialog').hasAttribute('data-open')).toBe(true);

		rerender(
			<Dialog open={false} onOpenChange={() => {}} title="Options">
				body
			</Dialog>,
		);
		const popup = screen.getByRole('dialog');
		expect(popup.hasAttribute('data-open')).toBe(false);
		expect(popup.hasAttribute('data-ending-style')).toBe(true);
	});

	// Base UI suppresses the backdrop of a *nested* dialog, so this only reproduces with one dialog
	// inside another — a standalone elevated dialog gets a backdrop either way and proves nothing.
	// Without it the inner dialog has nothing to dim the outer one with, and no z-index can help
	// because there is no element to raise.
	it('gives a dialog nested inside another its own raised backdrop', () => {
		render(
			<Dialog open onOpenChange={() => {}} title="Outer">
				<Dialog open onOpenChange={() => {}} elevated title="Working">
					body
				</Dialog>
			</Dialog>,
		);

		expect(screen.getAllByTestId('sim-dialog-backdrop').filter(el => el.getAttribute('data-elevated') === 'true')).toHaveLength(1);
		expect(screen.getAllByTestId('sim-dialog-viewport').filter(el => el.getAttribute('data-elevated') === 'true')).toHaveLength(1);
	});

	it('leaves a nested dialog without one when it is not elevated', () => {
		render(
			<Dialog open onOpenChange={() => {}} title="Outer">
				<Dialog open onOpenChange={() => {}} title="Working">
					body
				</Dialog>
			</Dialog>,
		);

		expect(screen.getAllByTestId('sim-dialog-backdrop').filter(el => el.getAttribute('data-elevated') === 'true')).toHaveLength(0);
	});

	it('closes only the innermost of two nested dialogs on Escape, and the outer one on a second Escape', () => {
		const outerChange = vi.fn();
		const innerChange = vi.fn();
		const NestedDialogs = () => {
			const [innerOpen, setInnerOpen] = useState(true);
			return (
				<Dialog open onOpenChange={outerChange} title="Outer">
					<Dialog
						open={innerOpen}
						onOpenChange={next => {
							innerChange(next);
							setInnerOpen(next);
						}}
						elevated
						title="Inner">
						body
					</Dialog>
				</Dialog>
			);
		};
		render(<NestedDialogs />);

		fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
		expect(innerChange).toHaveBeenCalledWith(false);
		expect(outerChange).not.toHaveBeenCalled();

		fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
		expect(outerChange).toHaveBeenCalledWith(false);
	});
});
