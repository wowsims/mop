import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createContext, useContext } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createToastManager, DEFAULT_TOAST_DELAY, toastManager } from './manager';
import { ToastArea } from './ToastArea';

const standardViewport = () => document.querySelector('.sim-toast-viewport:not(.sim-toast-viewport--inline)') as HTMLElement;

afterEach(() => {
	vi.useRealTimers();
});

describe('Toast', () => {
	it('renders a toast added through the module-level manager in the standard area', () => {
		render(<ToastArea manager={toastManager} />);
		act(() => {
			toastManager.add({ variant: 'success', body: 'Import successful!' });
		});

		const toast = standardViewport().querySelector('.sim-toast')!;
		expect(Array.from(toast.classList)).toEqual(['sim-toast', 'sim-toast--success']);
		expect(toast.querySelector('.sim-toast-title')?.textContent).toBe('WowSims');
		expect(toast.querySelector('.sim-toast-body')?.textContent).toBe('Import successful!');
		expect(toast.getAttribute('aria-describedby')).toBe(toast.querySelector('.sim-toast-body')?.id);
	});

	it('takes the title and the caller class from the options', () => {
		render(<ToastArea manager={toastManager} />);
		act(() => {
			toastManager.add({ variant: 'warning', body: 'Download it', title: 'Native sim', className: 'toast-notice-native-download' });
		});

		const toast = standardViewport().querySelector('.sim-toast')!;
		expect(Array.from(toast.classList)).toEqual(['sim-toast', 'sim-toast--warning', 'toast-notice-native-download']);
		expect(toast.querySelector('.sim-toast-title')?.textContent).toBe('Native sim');
	});

	// `body` is block content at several sites — `NoticeNativeSim` passes a `<div>` wrapping a `<p>`
	// and an `<a class="btn">`. Base UI's `Toast.Description` is a `<p>`, and a real parser reparents
	// block content out of one; happy-dom does not, so this asserts the tag rather than the nesting.
	it('renders the body in a div so block content is valid inside it', () => {
		render(<ToastArea manager={toastManager} />);
		act(() => {
			toastManager.add({
				variant: 'info',
				body: (
					<div>
						<p>Run it natively</p>
						<a href="https://example.invalid">Download</a>
					</div>
				),
			});
		});

		const body = standardViewport().querySelector('.sim-toast-body')!;
		expect(body.tagName).toBe('DIV');
		expect(body.querySelector('p')?.textContent).toBe('Run it natively');
	});

	it('renders the body inside the tree the area is mounted in, so the body can read context', () => {
		const Marker = createContext('not reached');
		const Body = () => <span data-testid="body-context">{useContext(Marker)}</span>;

		render(
			<Marker value="reached">
				<ToastArea manager={toastManager} />
			</Marker>,
		);
		act(() => {
			toastManager.add({ variant: 'success', body: <Body /> });
		});

		expect(screen.getByTestId('body-context').textContent).toBe('reached');
	});

	it('gives a second area its own manager and keeps the two apart', () => {
		const noticeManager = createToastManager();
		const host = document.createElement('div');
		document.body.appendChild(host);

		render(
			<>
				<ToastArea manager={toastManager} />
				<ToastArea manager={noticeManager} container={host} inline />
			</>,
		);
		act(() => {
			toastManager.add({ variant: 'info', body: 'standard body' });
			noticeManager.add({ variant: 'info', body: 'notice body' });
		});

		const standard = standardViewport();
		const notice = host.querySelector('.sim-toast-viewport--inline') as HTMLElement;

		expect(within(standard).getByText('standard body')).toBeTruthy();
		expect(within(standard).queryByText('notice body')).toBeNull();
		expect(within(notice).getByText('notice body')).toBeTruthy();
		expect(within(notice).queryByText('standard body')).toBeNull();

		host.remove();
	});

	it('renders no close button when canClose is false, and closes on it when it is true', async () => {
		const manager = createToastManager();
		render(<ToastArea manager={manager} />);
		act(() => {
			manager.add({ variant: 'warning', body: 'sealed', canClose: false, autohide: false });
		});
		expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();

		act(() => {
			manager.add({ variant: 'info', body: 'closable', autohide: false });
		});
		const close = screen.getByRole('button', { name: 'Close' });
		expect(close.getAttribute('type')).toBe('button');

		fireEvent.click(close);
		await waitFor(() => expect(screen.queryByText('closable')).toBeNull());
		expect(screen.getByText('sealed')).toBeTruthy();
	});

	it('gives the close button one glyph and a real size', () => {
		render(<ToastArea manager={toastManager} />);
		act(() => {
			toastManager.add({ variant: 'error', body: 'boom' });
		});

		const icon = screen.getByRole('button', { name: 'Close' }).querySelector('i')!;
		expect(Array.from(icon.classList)).toEqual(['fas', 'fa-times', 'fa-lg']);
		expect(standardViewport().querySelector('.sim-toast-icon')?.className).toBe('fas fa-circle-exclamation fa-2xl sim-toast-icon');
	});

	// The negative half is the control: without it the positive half passes even if no timer ever runs.
	it('auto-dismisses on the default delay but keeps a non-autohiding toast', async () => {
		vi.useFakeTimers();
		const manager = createToastManager();
		render(<ToastArea manager={manager} />);
		act(() => {
			manager.add({ variant: 'info', body: 'transient' });
			manager.add({ variant: 'info', body: 'sticky', autohide: false });
			manager.add({ variant: 'info', body: 'patient', delay: DEFAULT_TOAST_DELAY * 4 });
		});

		await act(async () => {
			await vi.advanceTimersByTimeAsync(DEFAULT_TOAST_DELAY + 100);
		});

		expect(screen.queryByText('transient')).toBeNull();
		expect(screen.getByText('sticky')).toBeTruthy();
		expect(screen.getByText('patient')).toBeTruthy();
	});

	// The viewport is portaled outside the component subtree, so React unmounting the area is what has
	// to take the toasts with it — `ImportWarning` relies on exactly this in its ref-callback cleanup.
	it('removes its toasts from the document when the area unmounts', () => {
		const manager = createToastManager();
		const host = document.createElement('div');
		document.body.appendChild(host);

		const { unmount } = render(<ToastArea manager={manager} container={host} inline />);
		act(() => {
			manager.add({ variant: 'warning', body: 'orphan', autohide: false });
		});
		expect(document.querySelectorAll('.sim-toast')).toHaveLength(1);

		unmount();

		expect(document.querySelectorAll('.sim-toast')).toHaveLength(0);
		expect(document.querySelectorAll('.sim-toast-viewport')).toHaveLength(0);
		expect(host.childElementCount).toBe(0);

		host.remove();
	});
});
