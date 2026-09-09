import { SimHostProvider } from '@sim/context/SimHostContext';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AplNameDialog, type AplNameDialogProps } from './AplNameDialog';

vi.mock('@i18n/config', () => ({ default: { t: (key: string) => key } }));

const host = { rootElem: document.body } as never;

const mount = (props: Partial<AplNameDialogProps> = {}) =>
	render(
		<SimHostProvider host={host}>
			<AplNameDialog open title="New Group" inputLabel="Name" existingNames={[]} onSubmit={() => {}} onClose={() => {}} {...props} />
		</SimHostProvider>,
	);

const rerenderDialog = (rerender: (ui: ReactElement) => void, props: Partial<AplNameDialogProps> = {}) =>
	rerender(
		<SimHostProvider host={host}>
			<AplNameDialog open title="New Group" inputLabel="Name" existingNames={[]} onSubmit={() => {}} onClose={() => {}} {...props} />
		</SimHostProvider>,
	);

const input = () => screen.getByRole('textbox') as HTMLInputElement;
const confirmButton = () => screen.getByRole('button', { name: 'rotation_tab.apl.nameModal.create' }) as HTMLButtonElement;

describe('AplNameDialog', () => {
	it('disables confirm for an empty or whitespace-only name', () => {
		mount({ defaultValue: '' });

		expect(confirmButton().disabled).toBe(true);

		act(() => {
			fireEvent.change(input(), { target: { value: '   ' } });
		});
		expect(confirmButton().disabled).toBe(true);
	});

	it('disables confirm, flags the input and shows the conflict message for a name already in existingNames', () => {
		mount({ existingNames: ['Taken'] });

		act(() => {
			fireEvent.change(input(), { target: { value: 'Taken' } });
		});

		expect(confirmButton().disabled).toBe(true);
		expect(input().classList.contains('is-invalid')).toBe(true);
		expect(screen.getByText('rotation_tab.apl.nameModal.nameConflict')).toBeTruthy();
	});

	it('submits on Enter only when the name is valid', () => {
		const onSubmit = vi.fn();
		mount({ existingNames: ['Taken'], onSubmit });

		act(() => {
			fireEvent.change(input(), { target: { value: 'Taken' } });
			fireEvent.keyDown(input(), { key: 'Enter' });
		});
		expect(onSubmit).not.toHaveBeenCalled();

		act(() => {
			fireEvent.change(input(), { target: { value: 'New Name' } });
			fireEvent.keyDown(input(), { key: 'Enter' });
		});
		expect(onSubmit).toHaveBeenCalledWith('New Name');
	});

	it('submits the trimmed name and closes after a successful submit', () => {
		const onSubmit = vi.fn();
		const onClose = vi.fn();
		mount({ onSubmit, onClose });

		act(() => {
			fireEvent.change(input(), { target: { value: '  Padded Name  ' } });
		});
		act(() => {
			fireEvent.click(confirmButton());
		});

		expect(onSubmit).toHaveBeenCalledWith('Padded Name');
		expect(onClose).toHaveBeenCalled();
	});

	it('fires onCancel when dismissed by the user but not after a successful submit', () => {
		const onCancel = vi.fn();
		const onSubmit = vi.fn();
		const { rerender } = mount({ onSubmit, onCancel });

		act(() => {
			fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
		});
		expect(onCancel).toHaveBeenCalledTimes(1);

		onCancel.mockClear();
		rerenderDialog(rerender, { onSubmit, onCancel });
		act(() => {
			fireEvent.change(input(), { target: { value: 'Fresh Name' } });
		});
		act(() => {
			fireEvent.click(confirmButton());
		});
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('resets the field to defaultValue on re-open', () => {
		const { rerender } = mount({ open: false, defaultValue: 'Original' });

		rerenderDialog(rerender, { defaultValue: 'Original' });
		expect(input().value).toBe('Original');

		act(() => {
			fireEvent.change(input(), { target: { value: 'Changed' } });
		});
		expect(input().value).toBe('Changed');

		rerenderDialog(rerender, { open: false, defaultValue: 'Original' });
		rerenderDialog(rerender, { defaultValue: 'Original' });
		expect(input().value).toBe('Original');
	});
});
