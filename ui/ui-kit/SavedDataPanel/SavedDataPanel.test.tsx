import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STRINGS: Record<string, string> = {
	'common.saved_data.delete_title': 'Delete saved {{label}}',
	'common.saved_data.delete_confirm': "Delete saved {{label}} '{{name}}'?",
	'common.saved_data.choose_name': 'Choose a label for your saved {{label}}!',
	'common.saved_data.name_exists': '{{label}} with name {{name}} already exists.',
	'common.delete': 'Delete',
	'common.cancel': 'Cancel',
	'common.ok': 'OK',
};

const translate = (key: string, vars?: Record<string, string>) =>
	Object.entries(vars ?? {}).reduce((text, [name, value]) => text.replaceAll(`{{${name}}}`, value), STRINGS[key] ?? key);

vi.mock('@i18n/config', () => ({ default: { t: translate } }));

const { SavedDataPanel } = await import('./SavedDataPanel');
const entryOf = (name: string, isPreset = false) => ({ name, data: name, json: name, isPreset });

const onSave = vi.fn();
const onDelete = vi.fn();

const mount = (extra: Partial<React.ComponentProps<typeof SavedDataPanel<string>>> = {}) =>
	render(
		<SavedDataPanel<string>
			title="Saved Gear"
			label="Gear Set"
			presets={[entryOf('Preset', true)]}
			userData={[entryOf('Mine')]}
			currentJson="nothing matches"
			onLoad={vi.fn()}
			onSave={onSave}
			onDelete={onDelete}
			{...extra}
		/>,
	);

const popover = () => document.querySelector('.sim-confirm-popover');
const popoverText = () => popover()?.querySelector('.sim-confirm-popover-message')?.textContent ?? '';
const popoverButtons = () => [...(popover()?.querySelectorAll<HTMLButtonElement>('.sim-confirm-popover-actions button') ?? [])];
const saveButton = () => document.querySelector('.saved-data-save-button') as HTMLButtonElement;
const nameInput = () => document.querySelector('.saved-data-save-input') as HTMLInputElement;
const deleteChip = () => document.querySelector('.saved-data-custom .saved-data-set-delete') as HTMLButtonElement;

beforeEach(() => {
	onSave.mockClear();
	onDelete.mockClear();
});

describe('SavedDataPanel', () => {
	it('asks for a label beside the create row instead of saving an unnamed entry', () => {
		mount();

		fireEvent.click(saveButton());

		expect(onSave).not.toHaveBeenCalled();
		expect(popoverText()).toBe('Choose a label for your saved Gear Set!');
		expect(popoverButtons()).toHaveLength(1);
		expect(popoverButtons()[0].textContent).toBe('OK');
	});

	it('refuses a name a preset already carries, and names it in the message', () => {
		mount();

		fireEvent.change(nameInput(), { target: { value: 'Preset' } });
		fireEvent.click(saveButton());

		expect(onSave).not.toHaveBeenCalled();
		expect(popoverText()).toBe('Gear Set with name Preset already exists.');
	});

	it('saves under a free name with nothing to acknowledge', () => {
		mount();

		fireEvent.change(nameInput(), { target: { value: 'Fresh' } });
		fireEvent.click(saveButton());

		expect(onSave).toHaveBeenCalledWith('Fresh');
		expect(popover()).toBeNull();
	});

	it('confirms a delete in a popover on the delete button, and drops it on cancel', () => {
		mount();

		fireEvent.click(deleteChip());
		expect(onDelete).not.toHaveBeenCalled();
		expect(popoverText()).toBe("Delete saved Gear Set 'Mine'?");

		const [cancel, confirm] = popoverButtons();
		expect([cancel.textContent, confirm.textContent]).toEqual(['Cancel', 'Delete']);
		expect(cancel.className).toContain('btn-outline-cancel');
		expect(confirm.className).toContain('btn-cancel');

		fireEvent.click(cancel);
		expect(onDelete).not.toHaveBeenCalled();
	});

	it('deletes the entry the popover names once it is confirmed', () => {
		mount();

		fireEvent.click(deleteChip());
		fireEvent.click(popoverButtons()[1]);

		expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mine' }));
	});

	it('prefers the message the caller gave it, with the name interpolated', () => {
		mount({ deleteConfirmMessage: "Throw away '{{name}}'?" });

		fireEvent.click(deleteChip());

		expect(popoverText()).toBe("Throw away 'Mine'?");
	});

	it('offers no delete on a preset', () => {
		mount();

		expect(document.querySelector('.saved-data-presets .saved-data-set-delete')).toBeNull();
	});

	it('mounts its popovers in the container it is given', () => {
		const host = document.createElement('div');
		document.body.appendChild(host);

		mount({ container: host });
		fireEvent.click(deleteChip());

		expect(host.querySelector('.sim-confirm-popover')).not.toBeNull();
		host.remove();
	});
});
