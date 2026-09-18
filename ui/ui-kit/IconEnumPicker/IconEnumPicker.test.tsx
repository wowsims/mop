import { ActionId } from '@sim/proto/action_id';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { IconEnumPicker } from './IconEnumPicker';
import { type IconEnumPickerConfig, IconEnumPickerDirection } from './types';
import { iconEnumPickerShown } from './utils';

// A filled ActionId as fill() returns one, so useActionId renders synchronously and no test touches
// the network — the same pattern IconPicker.test.tsx and MultiIconPicker.test.tsx use.
const filled = (actionId: ActionId, name: string, iconUrl: string) => Object.assign(Object.create(ActionId.prototype), actionId, { name, iconUrl }) as ActionId;

const frostId = filled(ActionId.fromSpellId(7302), 'Frost Armor', 'frost.jpg');
const moltenId = filled(ActionId.fromSpellId(30482), 'Molten Armor', 'molten.jpg');
// The hunter's "No Pet" entry: an id with neither an item nor a spell, so it has an icon and no
// wowhead page.
const noPetId = filled(ActionId.empty('No Pet', 'questionmark.jpg'), 'No Pet', 'questionmark.jpg');

/** Stands in for the player: one number, plus the `(onChange) => unsubscribe` contract. */
class Options {
	private listeners = new Set<() => void>();
	armor = 0;
	engineer = true;
	visible = true;
	set(next: number) {
		// The real facades drop equal writes (`Player.setConsumes` returns early), so the guard mirrors that here.
		if (this.armor === next) return;
		this.armor = next;
		this.notify();
	}
	setEngineer(next: boolean) {
		this.engineer = next;
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

const configFor = (extra: Partial<IconEnumPickerConfig<Options, number>> = {}): IconEnumPickerConfig<Options, number> => ({
	values: [
		{ value: 0, tooltip: 'No Armor' },
		{ actionId: frostId, value: 1 },
		{ actionId: moltenId, value: 2, tooltip: 'Molten' },
	],
	equals: (a, b) => a === b,
	zeroValue: 0,
	storeSubscribe: options => options.subscribe,
	getValue: options => options.armor,
	setValue: (options, next) => options.set(next),
	...extra,
});

const mount = (options: Options, config: IconEnumPickerConfig<Options, number> = configFor()) => render(<IconEnumPicker modObject={options} config={config} />);

const root = () => screen.getByTestId('icon-enum-picker-root');
const button = () => within(root()).getByTestId('icon-enum-picker-button') as HTMLAnchorElement;
const menu = () => (screen.queryByTestId('icon-enum-picker-menu') ?? null) as HTMLUListElement | null;
const items = () => Array.from(menu()!.children) as HTMLLIElement[];
const optionAnchor = (index: number) => within(items()[index]).getByTestId('icon-picker-button') as HTMLAnchorElement;
// The menu mounts when it opens, so every test that reads an option has to open it first.
const open = (trigger: HTMLElement = button()) =>
	act(() => {
		fireEvent.mouseEnter(trigger);
		fireEvent.mouseMove(trigger);
	});
const caption = () => within(root()).getByTestId('form-label') as HTMLLabelElement;
// happy-dom re-quotes the CSSOM value, so icons are compared by name rather than by literal.
const iconOf = (element: HTMLElement) => element.style.backgroundImage.replace(/^url\(['"]?|['"]?\)$/g, '');

beforeEach(() => {
	vi.spyOn(ActionId.prototype, 'fill').mockImplementation(async function (this: ActionId) {
		return this;
	});
});
afterEach(() => vi.restoreAllMocks());

describe('IconEnumPicker', () => {
	it('builds the root, the button and the caption in vanilla’s order', () => {
		mount(new Options());

		expect(root().classList.contains('relative')).toBe(true);
		expect(root().hasAttribute('data-input-root')).toBe(true);

		expect(Array.from(root().children).map(element => `${element.tagName.toLowerCase()}.${element.className}`)).toEqual([
			'a.ui-icon-picker-swatch transition-none',
			'label.ui-field-label',
		]);

		open();
		const portal = screen.getByTestId('icon-enum-picker-portal');
		expect(portal.className).toBe('contents');
		expect(portal.children[0].className).toBe('z-dropdown');
		expect(portal.children[0].getAttribute('data-testid')).toBe('icon-enum-picker-positioner');
		expect(menu()!.parentElement).toBe(portal.children[0]);

		expect(items().map(item => `${item.tagName.toLowerCase()}.${item.className}`)).toEqual(['li.', 'li.', 'li.']);
		expect(items().map(item => item.getAttribute('role'))).toEqual(['none', 'none', 'none']);
		expect(items().map(item => within(item).getByTestId('icon-picker-button').className)).toEqual([
			'ui-icon-picker-swatch filter-[opacity(0.7)] transition-none hover:filter-none',
			'ui-icon-picker-swatch filter-[opacity(0.7)] transition-none hover:filter-none',
			'ui-icon-picker-swatch filter-[opacity(0.7)] transition-none hover:filter-none',
		]);
	});

	it('mounts the options when the menu opens and renders none of them until then', () => {
		mount(new Options());
		expect(screen.queryByTestId('icon-enum-picker-portal')).toBeNull();
		expect(menu()).toBeNull();

		open();
		expect(menu()!.hasAttribute('hidden')).toBe(false);
		expect(items()).toHaveLength(3);
	});

	it('takes the button’s icon, href and active class from the selected value', () => {
		const options = new Options();
		mount(options);

		// The zero value carries neither an actionId nor an iconUrl nor a colour, so there is no image
		// and no link. React refuses to render a `javascript:` URL, so the button simply carries no
		// `href` at all.
		expect(iconOf(button())).toBe('');
		expect(button().hasAttribute('href')).toBe(false);
		expect(button().hasAttribute('data-active')).toBe(false);

		act(() => options.set(2));
		expect(iconOf(button())).toBe('molten.jpg');
		expect(button().getAttribute('href')).toBe(ActionId.makeSpellUrl(30482));
		expect(button().hasAttribute('data-active')).toBe(true);

		act(() => options.set(0));
		expect(iconOf(button())).toBe('');
		expect(button().hasAttribute('href')).toBe(false);
		expect(button().hasAttribute('data-active')).toBe(false);
	});

	it('leaves the button unlinked for an id that names neither an item nor a spell', () => {
		const options = new Options();
		options.armor = 1;
		mount(options, configFor({ values: [{ value: 0 }, { actionId: noPetId, value: 1 }] }));

		// `useActionId` resolves no href without an itemId or a spellId — but the icon is
		// still filled in, which is the pair this entry exists to keep apart.
		expect(iconOf(button())).toBe('questionmark.jpg');
		expect(button().hasAttribute('href')).toBe(false);
	});

	it('keeps the button focusable without an href', () => {
		mount(new Options());
		// An <a> with no href is not tabbable on its own; `nativeButton={false}` is what puts it back.
		expect(button().getAttribute('tabindex')).toBe('0');
		expect(button().getAttribute('role')).toBe('button');
	});

	it('grays an iconUrl value and paints a colour value', () => {
		const options = new Options();
		options.armor = 1;
		const config = configFor({
			values: [
				{ value: 0, color: '#123456' },
				{ value: 1, iconUrl: 'raw.jpg' },
				{ actionId: frostId, value: 2 },
			],
		});
		mount(options, config);

		expect(iconOf(button())).toBe('raw.jpg');
		expect(button().style.filter).toBe('grayscale(1)');

		act(() => options.set(0));
		expect(button().style.backgroundColor).toBe('#123456');
		expect(button().style.filter).toBe('');
	});

	it('shows the value’s text in the caption and hides the caption otherwise', () => {
		const options = new Options();
		mount(options, configFor({ values: [{ value: 0 }, { actionId: frostId, value: 1, text: '3' }] }));

		expect(caption().style.display).toBe('none');
		expect(caption().textContent).toBe('');

		act(() => options.set(1));
		expect(caption().style.display).toBe('block');
		expect(caption().textContent).toBe('3');
	});

	it('writes the value and closes the menu when an option is chosen', () => {
		const options = new Options();
		mount(options);

		open();
		expect(button().getAttribute('aria-expanded')).toBe('true');

		act(() => {
			fireEvent.click(optionAnchor(2));
		});
		expect(options.armor).toBe(2);
		expect(button().getAttribute('aria-expanded')).toBe('false');
	});

	it('cancels the anchor’s navigation when an option is chosen', () => {
		mount(new Options());
		open();
		const event = new MouseEvent('click', { bubbles: true, cancelable: true });
		act(() => {
			optionAnchor(1).dispatchEvent(event);
		});
		expect(event.defaultPrevented).toBe(true);
	});

	it('gives each option its own icon and wowhead link, and none of them the active class', () => {
		const options = new Options();
		options.armor = 1;
		mount(options);
		open();

		expect(items().map((_item, index) => iconOf(optionAnchor(index)))).toEqual(['', 'frost.jpg', 'molten.jpg']);
		expect(items().map((_item, index) => optionAnchor(index).getAttribute('href'))).toEqual([
			null,
			ActionId.makeSpellUrl(7302),
			ActionId.makeSpellUrl(30482),
		]);
		expect(items().some((_item, index) => optionAnchor(index).hasAttribute('data-active'))).toBe(false);
	});

	it('unmounts a value whose showWhen is false and brings the option back with it', () => {
		const options = new Options();
		const config = configFor({
			values: [{ value: 0 }, { actionId: frostId, value: 1 }, { actionId: moltenId, value: 2, showWhen: (obj: Options) => obj.engineer }],
		});
		mount(options, config);
		open();
		expect(items()).toHaveLength(3);
		expect(optionAnchor(2).getAttribute('href')).toBe(ActionId.makeSpellUrl(30482));

		act(() => options.setEngineer(false));
		expect(items()).toHaveLength(2);

		act(() => options.setEngineer(true));
		expect(items()).toHaveLength(3);
		expect(optionAnchor(2).getAttribute('href')).toBe(ActionId.makeSpellUrl(30482));
	});

	it('zeroes the selection when the option holding it is hidden', () => {
		const options = new Options();
		options.armor = 2;
		mount(
			options,
			configFor({
				values: [{ value: 0 }, { actionId: frostId, value: 1 }, { actionId: moltenId, value: 2, showWhen: (obj: Options) => obj.engineer }],
			}),
		);
		expect(options.armor).toBe(2);

		act(() => options.setEngineer(false));
		expect(options.armor).toBe(0);
	});

	it('renders no picker at all unless some option carries an actionId and is shown', () => {
		const options = new Options();
		// The override on showWhen(): a list of colour-only values names nothing to show.
		mount(options, configFor({ values: [{ value: 0, color: 'grey' }] }));
		expect(screen.queryByTestId('icon-enum-picker-root')).toBeNull();
	});

	it('unmounts on its own showWhen, and puts the value aside across it', () => {
		const options = new Options();
		options.armor = 2;
		mount(options, configFor({ showWhen: (obj: Options) => obj.visible }));
		expect(screen.queryByTestId('icon-enum-picker-root')).toBeTruthy();

		// storeValue(): zeroed while away, and nothing is left in the tree.
		act(() => options.setVisible(false));
		expect(screen.queryByTestId('icon-enum-picker-root')).toBeNull();
		expect(options.armor).toBe(0);

		// restoreValue(): the source was still zero, so what was put aside comes back.
		act(() => options.setVisible(true));
		expect(screen.queryByTestId('icon-enum-picker-root')).toBeTruthy();
		expect(options.armor).toBe(2);
	});

	it('lets a value set while the picker was hidden beat the one put aside', () => {
		const options = new Options();
		options.armor = 2;
		mount(options, configFor({ showWhen: (obj: Options) => obj.visible }));

		act(() => options.setVisible(false));
		expect(options.armor).toBe(0);
		// A preset writing while the picker is away.
		act(() => options.set(1));
		act(() => options.setVisible(true));
		expect(options.armor).toBe(1);
	});

	it('offers nothing to choose while hidden, so the put-aside value can only be beaten from the source', () => {
		const options = new Options();
		options.armor = 2;
		mount(options, configFor({ showWhen: (obj: Options) => obj.visible }));

		act(() => options.setVisible(false));
		expect(options.armor).toBe(0);
		// The menu went with the picker, so there is no option to click — a write to the source is the
		// only thing that can still beat what was put aside, which the test above covers.
		expect(screen.queryByTestId('icon-enum-picker-menu')).toBeNull();
	});

	it('writes disabled on the anchor as well as the class on the root', () => {
		const options = new Options();
		mount(options, configFor({ enableWhen: () => false }));

		expect(root().hasAttribute('data-disabled')).toBe(true);
		expect(button().hasAttribute('disabled')).toBe(true);
		// `disabled` lands on the root, not the button — so a disabled icon-enum picker still opened
		// its menu, and this one still can.
		expect(button().getAttribute('aria-disabled')).toBe(null);
	});

	it('never marks the button active while it is disabled', () => {
		const options = new Options();
		options.armor = 2;
		mount(options, configFor({ enableWhen: () => false }));
		expect(button().hasAttribute('data-active')).toBe(false);
	});

	it('lays the menu out from numColumns, and turns it sideways for a horizontal picker', () => {
		mount(new Options(), configFor({ numColumns: 5 }));
		open();
		expect(menu()!.style.gridTemplateColumns).toBe('repeat(5, 1fr)');
		expect(menu()!.style.gridAutoFlow).toBe('');
		expect(root().classList.contains('relative')).toBe(true);

		render(<IconEnumPicker modObject={new Options()} config={configFor({ direction: IconEnumPickerDirection.Horizontal })} />);
		const horizontal = screen.getAllByTestId('icon-enum-picker-root')[1];
		expect(horizontal.classList.contains('relative')).toBe(true);
		const horizontalButton = within(horizontal).getByTestId('icon-enum-picker-button');
		open(horizontalButton);
		const horizontalMenu = document.getElementById(horizontalButton.getAttribute('aria-controls')!) as HTMLUListElement;
		expect(horizontalMenu.style.gridAutoFlow).toBe('column');
	});

	it('positions the menu against the viewport', async () => {
		mount(new Options());
		await open();
		expect(screen.getByTestId('icon-enum-picker-positioner').style.position).toBe('fixed');
	});

	it('carries every tooltip on its anchor, and renders none until one is asked for', () => {
		mount(new Options(), configFor({ tooltip: 'Lethal Poison' }));

		const tooltipId = button().getAttribute('data-tooltip-id');
		expect(tooltipId).toBeTruthy();
		expect(button().getAttribute('data-tooltip-content')).toBe('Lethal Poison');
		// Before the menu is opened, because opening it is a hover on the button and a hover is what
		// asks for a tooltip.
		expect(document.querySelector('.sim-tooltip')).toBeNull();

		open();
		expect(optionAnchor(0).getAttribute('data-tooltip-content')).toBe('No Armor');
		expect(optionAnchor(0).getAttribute('data-tooltip-id')).toBe(tooltipId);
		// The value with no tooltip of its own opts out rather than anchoring an empty one.
		expect(optionAnchor(1).hasAttribute('data-tooltip-id')).toBe(false);
	});

	it('renders no tooltip anchor at all when nothing configures one', () => {
		mount(new Options(), configFor({ values: [{ value: 0 }, { actionId: frostId, value: 1 }] }));
		expect(root().querySelectorAll('[data-tooltip-id]')).toHaveLength(0);
	});

	it('does not put a value aside for a picker that mounts hidden', () => {
		const options = new Options();
		options.armor = 2;
		options.visible = false;
		// Store/restore is driven by the source subscription, so it never runs during construction —
		// and a bound picker renders twice at mount in every build, StrictMode or not. The revision
		// guard is what keeps the second of those renders from reading as a shown-to-hidden
		// transition and zeroing a source nobody touched.
		render(
			<StrictMode>
				<IconEnumPicker modObject={options} config={configFor({ showWhen: (obj: Options) => obj.visible })} />
			</StrictMode>,
		);
		expect(screen.queryByTestId('icon-enum-picker-root')).toBeNull();
		expect(options.armor).toBe(2);

		// And nothing was put aside, so coming back is a no-op rather than a restore.
		act(() => options.setVisible(true));
		expect(options.armor).toBe(2);
	});

	it('falls back to backupIconUrl for a value the list does not carry', () => {
		const options = new Options();
		options.armor = 99;
		mount(options, configFor({ backupIconUrl: () => moltenId }));

		expect(iconOf(button())).toBe('molten.jpg');
		expect(button().getAttribute('href')).toBe(ActionId.makeSpellUrl(30482));
		// `update()` runs after `setInputValue`, so the backup branch's own `setActive(false)` never
		// survives: a non-zero value is active whether or not the list carries it.
		expect(button().hasAttribute('data-active')).toBe(true);
	});
});

// The picker's own `showWhen()` override, asserted directly because a caller outside the component
// depends on it: a `.consumes-row` hides when every picker in it is hidden, and it has only the
// configs to ask.
describe('iconEnumPickerShown', () => {
	const options = new Options();

	it('needs a value that carries an actionId', () => {
		expect(
			iconEnumPickerShown(
				configFor({
					values: [
						{ value: 0, color: 'grey' },
						{ value: 1, iconUrl: 'raw.jpg' },
					],
				}),
				options,
			),
		).toBe(false);
		expect(iconEnumPickerShown(configFor(), options)).toBe(true);
	});

	it('ignores an actionId value that is itself hidden', () => {
		const hiddenOption = configFor({ values: [{ value: 0 }, { actionId: frostId, value: 1, showWhen: () => false }] });
		expect(iconEnumPickerShown(hiddenOption, options)).toBe(false);
	});

	it('honours the config’s own showWhen as well', () => {
		expect(iconEnumPickerShown(configFor({ showWhen: () => false }), options)).toBe(false);
		expect(iconEnumPickerShown(configFor({ showWhen: () => true }), options)).toBe(true);
	});
});

describe('IconEnumPickerConfig', () => {
	type WithoutBinding = Omit<IconEnumPickerConfig<Options, number>, 'storeSubscribe' | 'storeField'>;
	type FieldOnly = WithoutBinding & { storeField: 'bonusStats' };

	it('will not accept a config that names neither a store subscription nor a store field', () => {
		expectTypeOf<WithoutBinding>().not.toExtend<IconEnumPickerConfig<Options, number>>();
		expectTypeOf<FieldOnly>().toExtend<IconEnumPickerConfig<Options, number>>();
	});
});
