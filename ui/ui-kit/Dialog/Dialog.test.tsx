// What this pins is the part of `BaseModal`'s contract that is behaviour rather than styling, plus
// the places Base UI does not land in the same shape Bootstrap did. Those are asserted rather than
// avoided: each would otherwise be discovered by the first consumer that ports. The styling is
// pinned elsewhere — every box in all four sizes was measured against the built vanilla page and is
// identical, which is a browser measurement and not something happy-dom can make.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from './Dialog';

describe('Dialog', () => {
	it('builds the header/body/footer stack, with the caller class on the popup', () => {
		render(
			<Dialog
				open
				onOpenChange={() => {}}
				cssClass="advanced-encounter-picker-modal"
				size="xl"
				title="Encounter"
				footer={<button type="button">Done</button>}>
				<p>contents</p>
			</Dialog>,
		);

		const popup = screen.getByRole('dialog');
		// `cssClass` landed on `.modal-dialog` in vanilla; the popup is that element merged with
		// `.modal-content`, so it is the one that carries it.
		expect(Array.from(popup.classList).sort()).toEqual(['advanced-encounter-picker-modal', 'sim-dialog-popup', 'sim-dialog-popup--xl']);
		expect(Array.from(popup.children).map(el => el.className)).toEqual(['sim-dialog-header', 'sim-dialog-body', 'sim-dialog-footer']);
		expect(popup.querySelector('.sim-dialog-body')?.textContent).toBe('contents');
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

	// DIVERGENCE 1. Bootstrap put `role="dialog"` and `aria-modal` on the `.modal` wrapper and left
	// the `<h5 class="modal-title">` unreferenced, so the dialog had no accessible name. Base UI puts
	// the role on the popup and wires `aria-labelledby` to its own `<h2>` title.
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
		// The tree has several <button>s inside forms with no type; vanilla set this one explicitly.
		expect(close.getAttribute('type')).toBe('button');

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

	// DIVERGENCE 2. Vanilla rendered `.modal-header.p-0.border-0` — an empty, invisible element —
	// when a modal had neither a header nor a title. With `preventClose` there is nothing to put in
	// the header at all, so there is no header.
	it('drops the header bar rather than emptying it', () => {
		const { rerender } = render(
			<Dialog open onOpenChange={() => {}} header={false}>
				body
			</Dialog>,
		);
		expect(screen.getByRole('dialog').querySelector('.sim-dialog-header')?.className).toBe('sim-dialog-header sim-dialog-header--bare');

		rerender(
			<Dialog open onOpenChange={() => {}} header={false} preventClose>
				body
			</Dialog>,
		);
		expect(screen.getByRole('dialog').querySelector('.sim-dialog-header')).toBeNull();
	});

	// DIVERGENCE 3. `BaseModal` gave its `.modal` no `tabindex`, so Bootstrap's `_element.focus()`
	// was a no-op — measured on the built page, the encounter button keeps focus for as long as the
	// modal is open — and it marked nothing outside the modal, so the whole app stayed in the
	// accessibility tree behind it. Base UI makes the popup the focus target, guards it either side,
	// and hides everything else. (Which element receives focus first is layout-dependent and so is
	// not measurable here; Base UI documents it as the first tabbable element in the popup.)
	it('makes the popup the focus target and hides the rest of the document', () => {
		render(
			<Dialog open onOpenChange={() => {}} title="Options">
				<button type="button">Reset</button>
			</Dialog>,
		);

		const popup = screen.getByRole('dialog');
		expect(popup.getAttribute('tabindex')).toBe('-1');
		// Not `aria-modal`, which is what Bootstrap put on its wrapper. Base UI marks the siblings
		// instead, which is the stronger version of the same claim.
		expect(popup.getAttribute('aria-modal')).toBeNull();
		expect(popup.parentElement?.querySelectorAll('[data-base-ui-focus-guard]').length).toBe(2);

		const outside = Array.from(document.body.children).filter(el => !el.hasAttribute('data-base-ui-portal'));
		expect(outside.length).toBeGreaterThan(0);
		expect(outside.every(el => el.getAttribute('aria-hidden') === 'true')).toBe(true);
	});

	// DIVERGENCE 4, which is not assertable here: the page-scroll lock is layout-dependent, so it
	// does not engage under happy-dom at all. Measured in a real browser instead — Base UI writes
	// `overflow: hidden` inline on <body> and clears it on close, where Bootstrap wrote
	// `overflow: hidden; padding-right: 0px` *and* a `.modal-open` class. Nothing in this tree styles
	// `.modal-open`, so losing it costs nothing.

	// DIVERGENCE 5. Closing does not unmount at once — the popup stays in the tree carrying
	// `data-ending-style` until its transition finishes, which is the same window Bootstrap held open
	// between `hide.bs.modal` and `hidden.bs.modal`. A consumer that ports `disposeOnClose` has to
	// count on the exit, not on the state change.
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
});
