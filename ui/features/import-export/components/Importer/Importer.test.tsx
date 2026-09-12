// What this pins is the shell's behaviour, which is everything the four importers share: what gets
// handed to `onImport`, and what happens to the dialog when it resolves and when it rejects.
import { SimHostProvider } from '@sim/context/SimHostContext';
import { fakeHost } from '@sim/testing';
import { act, fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Importer } from './Importer';

const trackPageView = vi.hoisted(() => vi.fn());
vi.mock('../../../../tracking/analytics', () => ({ trackPageView }));

// What matters here is only that a rejected import reports a toast, and with the message the
// thrown error carried.
const toasts = vi.hoisted(() => [] as Array<{ variant: string; body: unknown }>);
vi.mock('@ui-kit/Toast', async importOriginal => ({
	...(await importOriginal<typeof import('@ui-kit/Toast')>()),
	toastManager: {
		add: (options: { variant: string; body: unknown }) => {
			toasts.push(options);
			return '';
		},
		close: () => {},
	},
}));

const rootElem = document.createElement('div');

/** The three references `useSimHost` hands out; the importer only ever reads `rootElem`. */
const host = fakeHost({ rootElem });

const renderImporter = (props: Partial<Parameters<typeof Importer>[0]> = {}) => {
	const onImport = props.onImport ?? vi.fn().mockResolvedValue(undefined);
	const onOpenChange = props.onOpenChange ?? vi.fn();
	render(
		<SimHostProvider host={host}>
			<Importer open title="JSON Import" allowFileUpload {...props} onImport={onImport} onOpenChange={onOpenChange}>
				<p>how to</p>
			</Importer>
		</SimHostProvider>,
	);
	return { onImport, onOpenChange };
};

// By class rather than by name: the i18n stub these tests run against returns the key, not the
// English string.
const clickImport = async () => {
	await act(async () => {
		fireEvent.click(rootElem.querySelector('button.import-button')!);
	});
};

describe('Importer', () => {
	beforeEach(() => {
		toasts.length = 0;
		trackPageView.mockClear();
		document.body.appendChild(rootElem);
	});

	it('hands the textarea contents and the host to onImport, then closes', async () => {
		const { onImport, onOpenChange } = renderImporter();
		const textarea = rootElem.querySelector('textarea')!;
		textarea.value = '{"player":{}}';

		await clickImport();

		expect(onImport).toHaveBeenCalledWith(host, '{"player":{}}');
		expect(onOpenChange).toHaveBeenCalledWith(false);
	});

	it('reports a rejected import as an error toast and leaves the dialog open', async () => {
		const { onOpenChange } = renderImporter({ onImport: vi.fn().mockRejectedValue(new Error('Could not parse Class!')) });

		await clickImport();

		expect(toasts).toEqual([{ variant: 'error', body: 'Import error: Could not parse Class!' }]);
		expect(onOpenChange).not.toHaveBeenCalled();
	});

	it('reports a page view under the importer title on open', () => {
		renderImporter();
		expect(trackPageView).toHaveBeenCalledWith('JSON Import', '/import/json-import');
	});

	it('does not report a page view while closed', () => {
		renderImporter({ open: false });
		expect(trackPageView).not.toHaveBeenCalled();
	});

	it('an upload replaces text the user has already typed', async () => {
		const { onImport } = renderImporter();
		const textarea = rootElem.querySelector('textarea')!;
		textarea.value = 'typed by hand';

		const upload = rootElem.querySelector<HTMLInputElement>('.importer-upload-input')!;
		await act(async () => {
			fireEvent.change(upload, { target: { files: [{ text: () => Promise.resolve('from the file') }] } });
		});

		await clickImport();
		expect(onImport).toHaveBeenCalledWith(host, 'from the file');
	});

	it('ignores a cancelled file picker', async () => {
		renderImporter();
		const upload = rootElem.querySelector<HTMLInputElement>('.importer-upload-input')!;
		await act(async () => {
			fireEvent.change(upload, { target: { files: [] } });
		});
		expect(rootElem.querySelector('textarea')!.value).toBe('');
	});

	it('labels the upload input, and shows the label only when uploading is allowed', () => {
		renderImporter();
		const upload = rootElem.querySelector<HTMLInputElement>('.importer-upload-input')!;
		expect(rootElem.querySelector('label.upload-button')!.getAttribute('for')).toBe(upload.id);
		// Derived from the title, because `keepMounted` puts every importer in the page at once.
		expect(upload.id).toBe('upload-input-json-import');
	});

	it('renders the hidden file input even when uploading is not allowed, as vanilla did', () => {
		renderImporter({ allowFileUpload: false });
		expect(rootElem.querySelector('label.upload-button')).toBe(null);
		expect(rootElem.querySelector('.importer-upload-input')).not.toBe(null);
	});

	it('puts the description above the textarea, inside .import-description', () => {
		renderImporter();
		const body = rootElem.querySelector('.sim-dialog-body > div')!;
		expect(Array.from(body.children).map(el => el.className)).toEqual(['import-description', 'importer-textarea form-control']);
		expect(body.querySelector('.import-description')!.textContent).toBe('how to');
	});
});
