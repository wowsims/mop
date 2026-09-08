import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PopoverProps } from './Popover';
import { Popover } from './Popover';

const outsideNodes: Element[] = [];

// Every outside element is created *before* the popover opens. floating-ui ignores presses on nodes
// that appear after it, on the reasoning that a third party injected them — so a node made later
// leaves the dismiss tests passing for a reason that has nothing to do with the dismiss.
const addOutside = (className?: string) => {
	const node = document.createElement('div');
	if (className) node.className = className;
	node.innerHTML = '<button type="button">Haste</button>';
	document.body.appendChild(node);
	outsideNodes.push(node);
	return node.querySelector('button')!;
};

// `outsidePressEvent.mouse` is `'intentional'` for a non-modal popover: the press is the whole
// sequence, and only the closing `click` dismisses.
const pressOutside = (node: Element) => {
	fireEvent.pointerDown(node);
	fireEvent.mouseDown(node);
	fireEvent.pointerUp(node);
	fireEvent.mouseUp(node);
	fireEvent.click(node);
};

const renderPopover = (props: Partial<PopoverProps> = {}) =>
	render(
		<Popover trigger="Settings" {...props}>
			<button type="button">Reset</button>
		</Popover>,
	);

const openPopover = (props: Partial<PopoverProps> = {}, triggerName = 'Settings') => {
	const result = renderPopover(props);
	const trigger = screen.getByRole('button', { name: triggerName });
	// A real press focuses the button it lands on; `fireEvent.click` does not.
	trigger.focus();
	fireEvent.click(trigger);
	return { ...result, trigger };
};

afterEach(() => {
	outsideNodes.splice(0).forEach(node => node.remove());
});

describe('Popover', () => {
	it('opens on a trigger click and renders its children into the portal', () => {
		const onOpenChange = vi.fn();
		const { trigger } = openPopover({ onOpenChange });

		expect(onOpenChange).toHaveBeenCalledWith(true);
		const popup = screen.getByRole('dialog');
		expect(popup.classList.contains('sim-popover-popup')).toBe(true);
		expect(screen.getByRole('button', { name: 'Reset' })).toBeTruthy();
		const portal = document.body.querySelector('[data-base-ui-portal]');
		expect(portal?.contains(popup)).toBe(true);
		expect(trigger.contains(popup)).toBe(false);
	});

	// The vanilla popover built its content in tippy's `onShow` and threw it away in `onHidden`
	// because tippy had no other way to get fresh content. Mounting on open is that mechanism, and
	// it is the whole of it — nothing here rebuilds or clears content.
	it('renders nothing while closed', () => {
		renderPopover();
		expect(screen.queryByRole('dialog')).toBeNull();
		expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
	});

	it('follows the open prop when it is given one', () => {
		const { rerender } = renderPopover({ open: false });
		expect(screen.queryByRole('dialog')).toBeNull();

		rerender(
			<Popover trigger="Settings" open>
				<button type="button">Reset</button>
			</Popover>,
		);
		expect(screen.getByRole('dialog')).toBeTruthy();
	});

	it('portals into the container it is given', () => {
		const host = document.createElement('div');
		host.className = 'sim-ui';
		document.body.appendChild(host);

		openPopover({ container: host });
		expect(host.contains(screen.getByRole('dialog'))).toBe(true);

		host.remove();
	});

	it('puts the caller class on the popup and the trigger class on the trigger', () => {
		const { trigger } = openPopover({ className: ['reforge-settings', 'w-100'], triggerClassName: 'suggest-reforges-button-settings' });

		expect(Array.from(screen.getByRole('dialog').classList).sort()).toEqual(['reforge-settings', 'sim-popover-popup', 'w-100']);
		expect(trigger.classList.contains('suggest-reforges-button-settings')).toBe(true);
	});

	it('forwards trigger props, so an icon-only trigger can be named and anchor a tooltip', () => {
		renderPopover({ triggerProps: { 'aria-label': 'Reforge settings', 'data-tooltip-id': 'reforge-settings-tip' } });

		const trigger = screen.getByRole('button', { name: 'Reforge settings' });
		expect(trigger.getAttribute('data-tooltip-id')).toBe('reforge-settings-tip');
		// A trigger inside a form must not submit it.
		expect(trigger.getAttribute('type')).toBe('button');
	});

	// DIVERGENCE. tippy's `interactive: true` never moved focus, and the pickers this popover is for
	// commit on their own events — so the default leaves focus on the trigger. Escape still closes,
	// because the dismiss listener is on the document rather than on the popup.
	it('leaves focus on the trigger by default, and still closes on Escape', () => {
		const onOpenChange = vi.fn();
		const { trigger } = openPopover({ onOpenChange });
		expect(document.activeElement).toBe(trigger);

		onOpenChange.mockClear();
		fireEvent.keyDown(trigger, { key: 'Escape' });
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(screen.getByRole('dialog').hasAttribute('data-open')).toBe(false);
	});

	// Asynchronous: Base UI focuses after the popup has been positioned, so this is a `waitFor`.
	it('moves focus to the first control in the popup when initialFocus is asked for', async () => {
		openPopover({ initialFocus: true });
		await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Reset' })));
	});

	it('closes on a press outside it', () => {
		const outside = addOutside();
		const onOpenChange = vi.fn();
		openPopover({ onOpenChange });
		onOpenChange.mockClear();

		pressOutside(outside);
		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(screen.getByRole('dialog').hasAttribute('data-open')).toBe(false);
	});

	// The bug class this pins: a popup whose portal node outlives the React tree that opened it. The
	// portal is a body child no ancestor unmount reaches, so nothing but Base UI's own cleanup removes it.
	it('takes its portal node with it when it unmounts', () => {
		const { unmount } = openPopover();
		expect(document.body.querySelectorAll('[data-base-ui-portal]').length).toBe(1);

		unmount();
		expect(document.body.querySelector('[data-base-ui-portal]')).toBeNull();
		expect(screen.queryByRole('dialog')).toBeNull();
	});

	it('takes its portal node with it when it unmounts from a container', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);

		const { unmount } = openPopover({ container: host });
		expect(host.querySelectorAll('.sim-popover-portal').length).toBe(1);

		unmount();
		expect(host.innerHTML).toBe('');
		host.remove();
	});
});
