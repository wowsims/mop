import type { StoreSubscribe } from '@sim/state/subscriptions';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { endDrag, getDrag } from './drag_state';
import { ListPicker } from './ListPicker';
import type { ListPickerConfig } from './types';

interface Row {
	name: string;
}

/** Stands in for a domain facade: a value plus the `(onChange) => unsubscribe` contract. */
class Rows {
	private listeners = new Set<() => void>();
	writes = 0;
	constructor(public value: Array<Row> = []) {}
	set(next: Array<Row>) {
		this.writes++;
		this.value = next;
		Array.from(this.listeners).forEach(listener => listener());
	}
	readonly subscribe: StoreSubscribe = listener => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};
}

const rowsOf = (...names: Array<string>) => new Rows(names.map(name => ({ name })));

const configFor = (extra: Partial<ListPickerConfig<Rows, Row>> = {}): ListPickerConfig<Rows, Row> =>
	({
		itemLabel: 'Target',
		storeSubscribe: (rows: Rows) => rows.subscribe,
		getValue: (rows: Rows) => rows.value,
		setValue: (rows: Rows, value: Array<Row>) => rows.set(value),
		newItem: () => ({ name: 'new' }),
		copyItem: (old: Row) => ({ ...old }),
		...extra,
	}) as ListPickerConfig<Rows, Row>;

const mount = (rows: Rows, extra: Partial<ListPickerConfig<Rows, Row>> = {}, renderItem?: (index: number) => React.ReactNode) =>
	render(
		<ListPicker<Rows, Row>
			modObject={rows}
			config={configFor(extra)}
			renderItem={renderItem ?? ((index, itemConfig) => <span className="leaf">{itemConfig.getValue(rows).name}</span>)}
		/>,
	);

const root = () => document.querySelector('.list-picker-root') as HTMLElement;
const itemsBox = () => root().querySelector('.list-picker-items') as HTMLElement;
const containers = () => [...root().querySelectorAll<HTMLElement>('.list-picker-item-container')];
const bodies = () => [...root().querySelectorAll<HTMLElement>('.list-picker-item .leaf')].map(node => node.textContent);
const newButton = () => root().querySelector('.list-picker-new-button') as HTMLButtonElement;
const actionsButton = (index: number) => containers()[index].querySelector('.list-picker-item-actions') as HTMLButtonElement;
const popoverButtons = (index: number) =>
	[...containers()[index].querySelectorAll<HTMLElement>('.list-picker-item-popover .list-picker-item-action')].map(button => button.className.split(' ')[1]);

// happy-dom has no drag data transfer; the handlers only ever read these three members.
const dataTransfer = () => ({ setDragImage: vi.fn(), dropEffect: '', effectAllowed: '' });

const startDrag = (index: number) => {
	const container = containers()[index];
	fireEvent.mouseDown(container);
	act(() => void fireEvent.dragStart(container, { dataTransfer: dataTransfer(), clientY: 0 }));
};

const dropOn = (index: number, clientY = 0) => {
	const container = containers()[index];
	act(() => void fireEvent.drop(container, { dataTransfer: dataTransfer(), clientY }));
};

afterEach(() => endDrag());

describe('ListPicker', () => {
	describe('markup', () => {
		it('renders the root, the items box and one container per item', () => {
			mount(rowsOf('a', 'b'));

			expect(root().className.split(' ').sort()).toEqual(['input-root', 'list-picker-root']);
			expect(itemsBox().className).toBe('list-picker-items');
			expect(containers()).toHaveLength(2);
			expect(bodies()).toEqual(['a', 'b']);
		});

		it('hides the items box while the list is empty, and unhides it when an item arrives', () => {
			const rows = rowsOf();
			mount(rows);
			expect(itemsBox().classList.contains('hide')).toBe(true);

			act(() => rows.set([{ name: 'a' }]));
			expect(itemsBox().classList.contains('hide')).toBe(false);
		});

		it('puts the header before the body, with a numbered title, when the menu bar is not inline', () => {
			mount(rowsOf('a'));

			const children = [...containers()[0].children].map(child => child.className);
			expect(children).toEqual(['list-picker-item-header', 'list-picker-item']);
			expect(containers()[0].querySelector('.list-picker-item-title')!.textContent).toBe('Target 1');
		});

		it('puts the body first and drops the title when the menu bar is inline', () => {
			mount(rowsOf('a'), { inlineMenuBar: true });

			const children = [...containers()[0].children].map(child => child.className);
			expect(children).toEqual(['list-picker-item', 'list-picker-item-header']);
			expect(containers()[0].querySelector('.list-picker-item-title')).toBeNull();
			expect(containers()[0].classList.contains('inline')).toBe(true);
		});

		it('carries the kebab-cased item label as a class while the item is draggable', () => {
			mount(rowsOf('a'), { itemLabel: 'Pre-Pull Action' });

			expect(containers()[0].classList.contains('pre-pull-action')).toBe(true);
			expect(containers()[0].classList.contains('draggable')).toBe(true);
		});

		it('folds the layout flags onto the root', () => {
			mount(rowsOf('a'), { isCompact: true, hideUi: true, horizontalLayout: true, extraCssClasses: ['targets-picker'] });

			const classes = root().className.split(' ');
			expect(classes).toContain('list-picker-compact');
			expect(classes).toContain('d-none');
			expect(classes).toContain('horizontal');
			expect(classes).toContain('targets-picker');
			// horizontalLayout forces the inline menu bar.
			expect(containers()[0].classList.contains('inline')).toBe(true);
		});

		it('renders the title as a span, not a label, and hangs the tooltip button inside it', () => {
			mount(rowsOf('a'), { title: 'Targets', titleTooltip: 'One row per target' });

			const title = root().querySelector('.list-picker-title')!;
			expect(title.tagName).toBe('SPAN');
			expect(title.textContent).toBe('Targets');
			expect(title.querySelector('button.tooltip-button.ms-2')).not.toBeNull();
		});

		it('renders header extras between the title and the actions button', () => {
			render(
				<ListPicker<Rows, Row>
					modObject={rowsOf('a')}
					config={configFor()}
					renderItem={() => <span className="leaf" />}
					renderItemHeader={index => <i className="hide-picker" data-index={index} />}
				/>,
			);

			const header = root().querySelector('.list-picker-item-header')!;
			expect([...header.children].map(child => child.className)).toEqual([
				'list-picker-item-popover',
				'list-picker-item-title',
				'hide-picker',
				'list-picker-item-action list-picker-item-actions',
			]);
		});
	});

	describe('actions', () => {
		it('appends a new item through newItem', () => {
			const rows = rowsOf('a');
			mount(rows);

			fireEvent.click(newButton());
			expect(rows.value.map(row => row.name)).toEqual(['a', 'new']);
		});

		it('renders the create button as an icon action when asked', () => {
			mount(rowsOf('a'), { actions: { create: { useIcon: true } } });

			expect(newButton().className.split(' ').sort()).toEqual(['link-success', 'list-picker-item-action', 'list-picker-new-button']);
			expect(newButton().querySelector('i')!.className).toBe('fa fa-xl fa-plus');
		});

		it('deletes the item at its index', () => {
			const rows = rowsOf('a', 'b', 'c');
			mount(rows);

			fireEvent.mouseOver(actionsButton(1));
			fireEvent.click(containers()[1].querySelector('.list-picker-item-delete')!);
			expect(rows.value.map(row => row.name)).toEqual(['a', 'c']);
		});

		it('copies the item in beside itself through copyItem', () => {
			const rows = rowsOf('a', 'b');
			mount(rows);

			fireEvent.mouseOver(actionsButton(1));
			fireEvent.click(containers()[1].querySelector('.list-picker-item-copy')!);
			expect(rows.value.map(row => row.name)).toEqual(['a', 'b', 'b']);
		});

		it('hands copying to onCopyItem when the caller owns it, and writes nothing itself', () => {
			const onCopyItem = vi.fn();
			const rows = rowsOf('a');
			mount(rows, { copyItem: undefined, onCopyItem } as Partial<ListPickerConfig<Rows, Row>>);

			fireEvent.mouseOver(actionsButton(0));
			fireEvent.click(containers()[0].querySelector('.list-picker-item-copy')!);
			expect(onCopyItem).toHaveBeenCalledWith(0);
			expect(rows.writes).toBe(0);
		});

		it('omits the delete button for the first minimumItems rows only', () => {
			mount(rowsOf('a', 'b'), { minimumItems: 1 });

			expect(popoverButtons(0)).toEqual(['list-picker-item-copy']);
			expect(popoverButtons(1)).toEqual(['list-picker-item-delete', 'list-picker-item-copy']);
		});

		it('honours allowedActions: no actions means no menu, no create button and no drag', () => {
			mount(rowsOf('a'), { allowedActions: [] });

			expect(root().querySelector('.list-picker-item-actions')).toBeNull();
			expect(newButton()).toBeNull();
			expect(containers()[0].classList.contains('draggable')).toBe(false);
		});

		it('renders extra actions in the menu, between delete and copy', () => {
			const onClick = vi.fn();
			mount(rowsOf('a'), {
				extraActions: [{ cssClass: 'list-picker-item-extract-variable', icon: 'fa-arrow-right-from-bracket', tooltip: 'Extract', onClick }],
			});

			expect(popoverButtons(0)).toEqual(['list-picker-item-delete', 'list-picker-item-extract-variable', 'list-picker-item-copy']);
			fireEvent.mouseOver(actionsButton(0));
			fireEvent.click(containers()[0].querySelector('.list-picker-item-extract-variable')!);
			expect(onClick).toHaveBeenCalledWith(0);
		});

		it('applies shouldShow only once the menu has been opened', () => {
			mount(rowsOf('a'), {
				extraActions: [{ cssClass: 'list-picker-item-extract-variable', icon: 'fa-x', tooltip: 'Extract', onClick: vi.fn(), shouldShow: () => false }],
			});
			const extra = () => containers()[0].querySelector<HTMLElement>('.list-picker-item-extract-variable')!;
			expect(extra().getAttribute('style')).toBeNull();

			fireEvent.mouseOver(actionsButton(0));
			expect(extra().style.display).toBe('none');
		});

		it('opens the menu on hover over the actions button and closes it when the popover is left', () => {
			mount(rowsOf('a'));
			const popover = () => containers()[0].querySelector('.list-picker-item-popover')!;
			expect(popover().className).toBe('list-picker-item-popover');

			fireEvent.mouseOver(actionsButton(0));
			expect(popover().className).toBe('list-picker-item-popover hover');

			fireEvent.mouseLeave(popover());
			expect(popover().className).toBe('list-picker-item-popover');
		});
	});

	describe('the per-item binding', () => {
		it('reads and writes the item at its own index', () => {
			const rows = rowsOf('a', 'b');
			render(
				<ListPicker<Rows, Row>
					modObject={rows}
					config={configFor()}
					renderItem={(index, itemConfig) => (
						<button className="leaf" onClick={() => itemConfig.setValue(rows, { name: `${index}!` })}>
							{itemConfig.getValue(rows).name}
						</button>
					)}
				/>,
			);
			expect(bodies()).toEqual(['a', 'b']);

			fireEvent.click(root().querySelectorAll('.leaf')[1]);
			expect(rows.value.map(row => row.name)).toEqual(['a', '1!']);
		});

		it("passes the list's store subscription down, so an item re-syncs on any notification", () => {
			const rows = rowsOf('a');
			mount(rows);

			act(() => rows.set([{ name: 'changed' }]));
			expect(bodies()).toEqual(['changed']);
		});
	});

	describe('drag', () => {
		it('is not draggable until a mousedown arms it', () => {
			mount(rowsOf('a', 'b'));
			expect(containers()[0].getAttribute('draggable')).toBeNull();

			fireEvent.mouseDown(containers()[0]);
			expect(containers()[0].getAttribute('draggable')).toBe('true');
		});

		it('does not arm on a mousedown inside a text input', () => {
			mount(rowsOf('a'), {}, () => <input className="leaf" />);
			const input = root().querySelector('input')!;

			fireEvent.mouseDown(input);
			expect(containers()[0].getAttribute('draggable')).toBeNull();
		});

		// happy-dom drops `clientY` from a synthetic DragEvent and reports an all-zero rect, so where
		// in the row the pointer was released cannot be expressed here. `dropIndex` and `moveItem`
		// carry that rule and are pinned directly in `utils.test.ts`.
		it('reorders within one list', () => {
			const rows = rowsOf('a', 'b', 'c');
			mount(rows);

			startDrag(2);
			dropOn(0);
			expect(rows.value.map(row => row.name)).toEqual(['c', 'a', 'b']);
		});

		it('refuses to drop an item on itself', () => {
			const rows = rowsOf('a', 'b');
			mount(rows);

			startDrag(1);
			dropOn(1);
			expect(rows.writes).toBe(0);
		});

		it('marks the source dragfrom and the hovered target dragto, and clears both at the end', () => {
			mount(rowsOf('a', 'b'));

			startDrag(0);
			expect(containers()[0].classList.contains('dragfrom')).toBe(true);
			act(() => void fireEvent.dragEnter(containers()[1], { dataTransfer: dataTransfer() }));
			expect(containers()[1].classList.contains('dragto')).toBe(true);

			act(() => void fireEvent.dragEnd(containers()[0], { dataTransfer: dataTransfer() }));
			expect(containers()[0].classList.contains('dragfrom')).toBe(false);
			expect(containers()[1].classList.contains('dragto')).toBe(false);
		});

		it('clears the drag slot when the drag ends', () => {
			mount(rowsOf('a', 'b'));

			startDrag(0);
			expect(getDrag()).not.toBeNull();
			act(() => void fireEvent.dragEnd(containers()[0], { dataTransfer: dataTransfer() }));
			expect(getDrag()).toBeNull();
		});
	});

	describe('drag between two lists', () => {
		const mountPair = (left: Rows, right: Rows, leftExtra = {}, rightExtra = {}) =>
			render(
				<>
					<div id="left">
						<ListPicker<Rows, Row>
							modObject={left}
							config={configFor(leftExtra)}
							renderItem={(index, itemConfig) => <span className="leaf">{itemConfig.getValue(left).name}</span>}
						/>
					</div>
					<div id="right">
						<ListPicker<Rows, Row>
							modObject={right}
							config={configFor(rightExtra)}
							renderItem={(index, itemConfig) => <span className="leaf">{itemConfig.getValue(right).name}</span>}
						/>
					</div>
				</>,
			);

		const boxes = (side: string) => [...document.querySelectorAll<HTMLElement>(`#${side} .list-picker-item-container`)];

		it('moves an item from one list into another of the same kind', () => {
			const left = rowsOf('a', 'b');
			const right = rowsOf('x');
			mountPair(left, right);

			const source = boxes('left')[0];
			fireEvent.mouseDown(source);
			act(() => void fireEvent.dragStart(source, { dataTransfer: dataTransfer(), clientY: 0 }));
			act(() => void fireEvent.drop(boxes('right')[0], { dataTransfer: dataTransfer(), clientY: 0 }));

			expect(left.value.map(row => row.name)).toEqual(['b']);
			expect(right.value.map(row => row.name)).toEqual(['a', 'x']);
		});

		it('refuses a drop from a list with a different itemLabel', () => {
			const left = rowsOf('a');
			const right = rowsOf('x');
			mountPair(left, right, { itemLabel: 'Value' }, { itemLabel: 'Action' });

			const source = boxes('left')[0];
			fireEvent.mouseDown(source);
			act(() => void fireEvent.dragStart(source, { dataTransfer: dataTransfer(), clientY: 0 }));
			act(() => void fireEvent.drop(boxes('right')[0], { dataTransfer: dataTransfer(), clientY: 0 }));

			expect(left.value.map(row => row.name)).toEqual(['a']);
			expect(right.value.map(row => row.name)).toEqual(['x']);
		});

		it('refuses a cross-list drop into a sameGroupOnly list that does not share the dragGroup', () => {
			const left = rowsOf('a');
			const right = rowsOf('x');
			mountPair(left, right, { sameGroupOnly: true }, { sameGroupOnly: true, dragGroup: 'group-actions' });

			const source = boxes('left')[0];
			fireEvent.mouseDown(source);
			act(() => void fireEvent.dragStart(source, { dataTransfer: dataTransfer(), clientY: 0 }));
			act(() => void fireEvent.drop(boxes('right')[0], { dataTransfer: dataTransfer(), clientY: 0 }));

			expect(right.value.map(row => row.name)).toEqual(['x']);
		});

		it('allows a cross-list drop when both name the same dragGroup', () => {
			const left = rowsOf('a');
			const right = rowsOf('x');
			mountPair(left, right, { sameGroupOnly: true, dragGroup: 'group-actions' }, { sameGroupOnly: true, dragGroup: 'group-actions' });

			const source = boxes('left')[0];
			fireEvent.mouseDown(source);
			act(() => void fireEvent.dragStart(source, { dataTransfer: dataTransfer(), clientY: 0 }));
			act(() => void fireEvent.drop(boxes('right')[0], { dataTransfer: dataTransfer(), clientY: 0 }));

			expect(left.value.map(row => row.name)).toEqual([]);
			expect(right.value.map(row => row.name)).toEqual(['a', 'x']);
		});
	});

	describe('showWhen and enableWhen', () => {
		it('adds hide rather than unmounting', () => {
			mount(rowsOf('a'), { showWhen: () => false });

			expect(root().classList.contains('hide')).toBe(true);
			expect(containers()).toHaveLength(1);
		});

		it('adds disabled when enableWhen says no', () => {
			mount(rowsOf('a'), { enableWhen: () => false });

			expect(root().classList.contains('disabled')).toBe(true);
		});

		// `disabled` is only valid on a form control, and nothing in the tree selects `[disabled]`.
		it('reports a disabled list without putting a form-control attribute on a div', () => {
			mount(rowsOf('a'), { enableWhen: () => false });

			expect(root().getAttribute('disabled')).toBeNull();
			expect(root().getAttribute('data-disabled')).toBe('');
		});
	});

	// A `<button>` with no `type` submits any form it is dropped into.
	it('types the create button', () => {
		mount(rowsOf('a'));

		expect(document.querySelector('.list-picker-new-button')!.getAttribute('type')).toBe('button');
	});
});
