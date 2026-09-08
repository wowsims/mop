import type { StoreSubscribe } from '@sim/state/subscriptions';
import { Input, type InputConfig } from '@ui-kit/input';
import { ListPicker as VanillaListPicker, type ListPickerConfig as VanillaListPickerConfig } from '@ui-kit/pickers/list_picker';
import { mountBoth } from '@ui-kit/testing/PickerOracle';
import { describe, expect, it } from 'vitest';

import { ListPicker } from './ListPicker';
import type { ListPickerConfig } from './types';

interface Row {
	name: string;
}

class Rows {
	private listeners = new Set<() => void>();
	constructor(public value: Array<Row> = []) {}
	set(next: Array<Row>) {
		this.value = next;
		Array.from(this.listeners).forEach(listener => listener());
	}
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
}

/** The smallest thing `newItemPicker`'s contract accepts: one `<span>` holding the row's name. */
class VanillaRowPicker extends Input<Rows, Row> {
	private readonly span: HTMLSpanElement;
	constructor(parent: HTMLElement, rows: Rows, config: InputConfig<Rows, Row>) {
		super(parent, 'row-picker-root', rows, config);
		this.span = document.createElement('span');
		this.span.classList.add('leaf');
		this.rootElem.appendChild(this.span);
		this.init();
	}
	getInputElem() {
		return this.span;
	}
	getInputValue(): Row {
		return { name: this.span.textContent || '' };
	}
	setInputValue(newValue: Row) {
		this.span.textContent = newValue?.name ?? '';
	}
}

const shared = {
	itemLabel: 'Target',
	storeSubscribe: (rows: Rows) => rows.subscribe,
	getValue: (rows: Rows) => rows.value,
	setValue: (rows: Rows, value: Array<Row>) => rows.set(value),
	newItem: () => ({ name: 'new' }),
	copyItem: (old: Row) => ({ ...old }),
};

const vanillaConfig = (extra: Partial<VanillaListPickerConfig<Rows, Row>>): VanillaListPickerConfig<Rows, Row> =>
	({
		...shared,
		// The second argument is the list itself, so the mod object comes off it.
		newItemPicker: (parent: HTMLElement, list: VanillaListPicker<Rows, Row>, _index: number, config: InputConfig<Rows, Row>) =>
			new VanillaRowPicker(parent, list.modObject, config),
		...extra,
	}) as unknown as VanillaListPickerConfig<Rows, Row>;

const reactConfig = (extra: Partial<ListPickerConfig<Rows, Row>>): ListPickerConfig<Rows, Row> => ({ ...shared, ...extra }) as ListPickerConfig<Rows, Row>;

/** `mountBoth` renders `React` with `{ modObject, config }`; the render prop is bound here. */
const ReactListPicker = ({ modObject, config }: { modObject: Rows; config: ListPickerConfig<Rows, Row> }) => (
	<ListPicker<Rows, Row>
		modObject={modObject}
		config={config}
		renderItem={(_index, itemConfig) => (
			<div className="input-root row-picker-root">
				<span className="leaf">{itemConfig.getValue(modObject)?.name ?? ''}</span>
			</div>
		)}
	/>
);

const both = (value: Array<Row>, extra: Partial<ListPickerConfig<Rows, Row>> = {}) =>
	mountBoth<Rows, ListPickerConfig<Rows, Row>>({
		Vanilla: class {
			private readonly picker: VanillaListPicker<Rows, Row>;
			readonly rootElem: HTMLElement;
			constructor(parent: HTMLElement, rows: Rows) {
				this.picker = new VanillaListPicker(parent, rows, vanillaConfig(extra as never));
				this.rootElem = this.picker.rootElem;
			}
			dispose() {
				this.picker.dispose();
			}
		},
		React: ReactListPicker,
		config: reactConfig(extra),
		makeModObject: () => new Rows(value.map(row => ({ ...row }))),
		normaliseVanilla: foldVanillaDefects,
		portAdded: PORT_ADDED,
	});

/**
 * `data-tooltip-*`: the port carries each button's tooltip on the anchor, where vanilla attached a
 * `tippy()` instance per button and wrote no attribute at all.
 * `tabindex`: Base UI's `Button` stamps `tabindex="0"` on every `<button>` it renders — redundant on
 * a natively focusable element, and the same on every ported component in this tree.
 */
const PORT_ADDED = /^(data-tooltip-id|data-tooltip-content|tabindex)$/;

/**
 * Two markup defects the port fixes rather than reproduces, folded onto the vanilla side so the
 * rest of the tree is still compared attribute for attribute. Each is asserted directly below.
 *
 * 1. Vanilla's non-icon create button is a bare `<button>` with no `type`, so it submits any form
 *    it is dropped into. `Button` types it.
 * 2. `Input.update()` writes `disabled=""` onto whatever `getInputElem()` returns, and this list
 *    returns its own root `<div>`. `disabled` is only valid on form controls, nothing in the tree
 *    selects `[disabled]`, and Base UI's `Field` reports the same state as `data-disabled`.
 */
const foldVanillaDefects = (lines: Array<string>): Array<string> =>
	lines.map(line =>
		line
			.replace('class="btn btn-primary list-picker-new-button"', 'class="btn btn-primary list-picker-new-button" type="button"')
			.replace(/^(\s*<div class="input-root list-picker-root[^"]*") disabled=""/, '$1'),
	);

const rows = (...names: Array<string>) => names.map(name => ({ name }));

describe('ListPicker matches the vanilla list', () => {
	const cases: Array<[string, Partial<ListPickerConfig<Rows, Row>>]> = [
		['bare config', {}],
		['inline menu bar', { inlineMenuBar: true }],
		['compact', { isCompact: true }],
		['horizontal', { horizontalLayout: true }],
		['hidden ui', { hideUi: true }],
		['extraCssClasses', { extraCssClasses: ['targets-picker', 'mb-0'] }],
		['minimumItems', { minimumItems: 1 }],
		['no actions at all', { allowedActions: [] }],
		['copy and delete only', { allowedActions: ['copy', 'delete'] }],
		['icon create button', { actions: { create: { useIcon: true } } }],
		['enableWhen false', { enableWhen: () => false }],
		['showWhen false', { showWhen: () => false }],
	];

	for (const [name, extra] of cases) {
		it(`renders the same tree — ${name}`, async () => {
			const pair = await both(rows('a', 'b'), extra);
			expect(pair.diff()).toEqual([]);
			pair.dispose();
		});
	}

	it('renders the same tree when the list is empty', async () => {
		const pair = await both([]);
		expect(pair.diff()).toEqual([]);
		pair.dispose();
	});

	it('stays in step as items are added and removed at the source', async () => {
		const pair = await both(rows('a'));

		await pair.step(model => model.set([...model.value, { name: 'b' }, { name: 'c' }]));
		expect(pair.diff()).toEqual([]);

		await pair.step(model => model.set(model.value.slice(0, 1)));
		expect(pair.diff()).toEqual([]);

		await pair.step(model => model.set([]));
		expect(pair.diff()).toEqual([]);

		pair.dispose();
	});

	it('types the create button, which vanilla left able to submit a surrounding form', async () => {
		const pair = await both(rows('a'));

		expect(pair.vanilla.rootElem.querySelector('.list-picker-new-button')!.getAttribute('type')).toBeNull();
		expect(pair.react.rootElem.querySelector('.list-picker-new-button')!.getAttribute('type')).toBe('button');

		pair.dispose();
	});

	it('reports a disabled list without putting a form-control attribute on a div', async () => {
		const pair = await both(rows('a'), { enableWhen: () => false });

		expect(pair.vanilla.rootElem.getAttribute('disabled')).toBe('');
		expect(pair.react.rootElem.getAttribute('disabled')).toBeNull();
		expect(pair.react.rootElem.getAttribute('data-disabled')).toBe('');
		expect(pair.react.rootElem.classList.contains('disabled')).toBe(true);

		pair.dispose();
	});

	it('shows the same item bodies after a value change', async () => {
		const pair = await both(rows('a', 'b'));
		await pair.step(model => model.set(rows('x', 'y')));

		const text = (root: Element) => [...root.querySelectorAll('.leaf')].map(node => node.textContent);
		expect(text(pair.react.rootElem)).toEqual(['x', 'y']);
		expect(text(pair.vanilla.rootElem)).toEqual(text(pair.react.rootElem));

		pair.dispose();
	});
});
