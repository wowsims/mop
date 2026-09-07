import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SavedDataManager } from './saved_data_manager';

vi.mock('tippy.js', () => ({ default: () => ({ destroy: () => undefined }) }));
vi.mock('../tracking/analytics', () => ({ trackEvent: vi.fn() }));

const nameInput = (root: HTMLElement) => root.querySelector<HTMLInputElement>('.saved-data-save-input')!;
const saveButton = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.saved-data-save-button')!;
const chips = (root: HTMLElement, section: 'presets' | 'custom') => [...root.querySelectorAll(`.saved-data-${section} .saved-data-set-chip`)];

let parent: HTMLElement;
let manager: SavedDataManager<any, string>;

beforeEach(() => {
	parent = document.createElement('div');
	document.body.appendChild(parent);
	manager = new SavedDataManager<any, string>(
		parent,
		{},
		{
			label: 'thing',
			storageKey: 'saved-data-manager-test',
			subscribe: () => () => undefined,
			getData: () => 'current',
			setData: () => undefined,
			toJson: a => a,
			fromJson: obj => obj,
		},
	);
	manager.addSavedData({ name: 'Default', isPreset: true, data: 'preset-value' });
	window.localStorage.removeItem('saved-data-manager-test');
});

describe('SavedDataManager name-collision check', () => {
	it('refuses to save a name that already names a preset', () => {
		const alert = vi.fn();
		vi.stubGlobal('alert', alert);

		fireEvent.change(nameInput(parent), { target: { value: 'Default' } });
		fireEvent.click(saveButton(parent));

		expect(alert).toHaveBeenCalledWith('thing with name Default already exists.');
		expect(chips(parent, 'custom')).toHaveLength(0);

		vi.unstubAllGlobals();
	});

	it('still allows resaving over an existing user entry of the same name', () => {
		fireEvent.change(nameInput(parent), { target: { value: 'Mine' } });
		fireEvent.click(saveButton(parent));
		fireEvent.change(nameInput(parent), { target: { value: 'Mine' } });
		fireEvent.click(saveButton(parent));

		expect(chips(parent, 'custom')).toHaveLength(1);
	});
});
