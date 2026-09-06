import { ActionId } from '@domain/proto_utils/action_id';
import type { StoreSubscribe } from '@domain/state/subscriptions';
import { act, fireEvent, render } from '@testing-library/react';
import type { IconPickerConfig } from '@ui-kit/pickers/icon_picker';
import type { MultiIconPickerConfig } from '@ui-kit/pickers/multi_icon_picker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MultiIconPicker } from './MultiIconPicker';

// A filled ActionId as fill() returns one, so useActionId renders synchronously and no test touches
// the network — the same pattern IconPicker.test.tsx uses.
const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const kingsId = filled(ActionId.fromSpellId(20217), 'Kings', 'kings.jpg');
const markId = filled(ActionId.fromSpellId(1126), 'Mark', 'mark.jpg');
const emperorId = filled(ActionId.fromSpellId(115921), 'Emperor', 'emperor.jpg');
const improvedId = filled(ActionId.fromSpellId(9000), 'Improved', 'improved.jpg');
const categoryId = filled(ActionId.fromSpellId(9999), 'Category', 'category.jpg');

/** Stands in for the player: one number per buff, plus the `(onChange) => unsubscribe` contract. */
class Buffs {
	private listeners = new Set<() => void>();
	readonly values: Record<string, number> = { kings: 0, mark: 0, emperor: 0 };
	visible = true;
	set(field: string, value: number) {
		this.values[field] = value;
		this.notify();
	}
	setVisible(next: boolean) {
		this.visible = next;
		this.notify();
	}
	notify() {
		this.listeners.forEach(listener => listener());
	}
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
}

const input = (field: string, actionId: ActionId, extra: Partial<IconPickerConfig<Buffs, number>> = {}): IconPickerConfig<Buffs, number> => ({
	actionId,
	states: 2,
	storeSubscribe: buffs => buffs.subscribe,
	getValue: buffs => buffs.values[field],
	setValue: (buffs, value) => buffs.set(field, Number(value)),
	...extra,
});

const configFor = (extra: Partial<MultiIconPickerConfig<Buffs>> = {}): MultiIconPickerConfig<Buffs> => ({
	inputs: [input('kings', kingsId), input('mark', markId), input('emperor', emperorId)],
	label: 'Stats',
	...extra,
});

const mount = (buffs: Buffs, config: MultiIconPickerConfig<Buffs> = configFor(), onClear = () => {}) =>
	render(<MultiIconPicker modObject={buffs} config={config} subscribe={buffs.subscribe} onClear={onClear} />);

const root = () => document.querySelector('.multi-icon-picker-root') as HTMLElement;
const trigger = () => root().querySelector(':scope > .dropend > .icon-picker-button') as HTMLAnchorElement;
const menu = () => root().querySelector('ul') as HTMLUListElement;
const blankOption = () => root().querySelector('a.icon-dropdown-option') as HTMLAnchorElement;
// happy-dom re-quotes the CSSOM value, so the icon is compared by name rather than by literal.
const backgroundIcon = () => trigger().style.backgroundImage.replace(/^url\(['"]?|['"]?\)$/g, '');

beforeEach(() => {
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return this;
	});
});
afterEach(() => vi.restoreAllMocks());

describe('MultiIconPicker', () => {
	it('builds the root, the dropend and the option list vanilla built', () => {
		mount(new Buffs());

		expect(root().className).toBe('multi-icon-picker-root icon-picker');
		expect(root().children[0].className).toBe('dropend');
		expect(trigger()).toBeTruthy();

		// The blank "clear" option first, then one option per input, each wrapping an IconPicker.
		const options = Array.from(menu().children);
		expect(options).toHaveLength(4);
		expect(options[0].querySelector('a')?.className).toBe('icon-dropdown-option dropdown-option');
		expect(options.slice(1).map(option => option.className)).toEqual([
			'icon-picker-option dropdown-option',
			'icon-picker-option dropdown-option',
			'icon-picker-option dropdown-option',
		]);
		expect(options.slice(1).every(option => option.querySelector('.icon-picker-root'))).toBe(true);
	});

	it('renders the label only when the config names one, and names the group with it', () => {
		const withLabel = mount(new Buffs());
		// A <span>, not a <label>: it names the icon group, which is not a form control.
		const caption = root().querySelector('span.multi-icon-picker-label.form-label');
		expect(caption?.textContent).toBe('Stats');
		expect(root().getAttribute('role')).toBe('group');
		expect(root().getAttribute('aria-labelledby')).toBe(caption!.id);
		withLabel.unmount();

		mount(new Buffs(), configFor({ label: undefined }));
		expect(root().querySelector('label')).toBeNull();
	});

	it('takes the button image from the first active child, not the last', () => {
		const buffs = new Buffs();
		mount(buffs);
		expect(trigger().classList.contains('active')).toBe(false);
		expect(backgroundIcon()).toBe('');

		act(() => buffs.set('emperor', 1));
		expect(trigger().classList.contains('active')).toBe(true);
		expect(backgroundIcon()).toBe('emperor.jpg');

		// Kings is earlier in the list, so it takes the icon over the one already on.
		act(() => buffs.set('kings', 1));
		expect(backgroundIcon()).toBe('kings.jpg');

		act(() => buffs.set('kings', 0));
		act(() => buffs.set('emperor', 0));
		expect(trigger().classList.contains('active')).toBe(false);
		expect(backgroundIcon()).toBe('');
	});

	it('uses the improved id at state 2, as IconPicker.getActionId does', () => {
		const buffs = new Buffs();
		mount(buffs, configFor({ inputs: [input('kings', kingsId, { states: 3, improvedId })] }));

		act(() => buffs.set('kings', 1));
		expect(backgroundIcon()).toBe('kings.jpg');
		act(() => buffs.set('kings', 2));
		expect(backgroundIcon()).toBe('improved.jpg');
	});

	it('prefers categoryId over the active child, and keeps it while nothing is on', () => {
		const buffs = new Buffs();
		mount(buffs, configFor({ categoryId }));

		expect(trigger().classList.contains('active')).toBe(false);
		expect(backgroundIcon()).toBe('category.jpg');

		act(() => buffs.set('kings', 1));
		expect(trigger().classList.contains('active')).toBe(true);
		expect(backgroundIcon()).toBe('category.jpg');
	});

	it('never gives the button an href', () => {
		const buffs = new Buffs();
		mount(buffs);
		act(() => buffs.set('kings', 1));
		expect(trigger().hasAttribute('href')).toBe(false);
	});

	it('renders showWhen as the hide class and leaves the node in the DOM', () => {
		const buffs = new Buffs();
		mount(buffs, configFor({ showWhen: (player: any) => (player as Buffs).visible }));
		expect(root().classList.contains('hide')).toBe(false);

		act(() => buffs.setVisible(false));
		expect(document.querySelector('.multi-icon-picker-root')).toBeTruthy();
		expect(root().classList.contains('hide')).toBe(true);

		act(() => buffs.setVisible(true));
		expect(root().classList.contains('hide')).toBe(false);
	});

	it('clears from a right-click on the button and from the blank option, and not from a left-click', () => {
		const onClear = vi.fn();
		mount(new Buffs(), configFor(), onClear);

		fireEvent.mouseDown(trigger(), { button: 0 });
		expect(onClear).not.toHaveBeenCalled();

		fireEvent.mouseDown(trigger(), { button: 2 });
		expect(onClear).toHaveBeenCalledTimes(1);

		fireEvent.click(blankOption());
		expect(onClear).toHaveBeenCalledTimes(2);
	});

	it('prevents the context menu on the button', () => {
		mount(new Buffs());
		const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
		trigger().dispatchEvent(event);
		expect(event.defaultPrevented).toBe(true);
	});
});
