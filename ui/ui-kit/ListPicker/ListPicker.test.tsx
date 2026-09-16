import { useStoreSubscribe } from '@sim/hooks/useStoreSubscribe';
import type { StoreSubscribe } from '@sim/state/subscriptions';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { memo, useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { endDrag, getDrag } from './drag_state';
import { ListPicker } from './ListPicker';
import type { ListItemPickerConfig, ListPickerConfig } from './types';

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
			renderItem={renderItem ?? ((index, itemConfig) => <span data-testid="leaf">{itemConfig.getValue(rows).name}</span>)}
		/>,
	);

const root = () => screen.getByTestId('list-picker-root');
const itemsBox = () => within(root()).getByTestId('list-picker-items');
const containers = () => within(root()).queryAllByTestId('list-picker-item-container');
const bodies = () =>
	within(root())
		.queryAllByTestId('list-picker-item')
		.map(node => node.querySelector('[data-testid="leaf"]')?.textContent);
const newButton = () => within(root()).queryByTestId('list-picker-new-button') as HTMLButtonElement | null;
const actionsButton = (index: number) => within(containers()[index]).getByTestId('list-picker-item-actions') as HTMLButtonElement;
const openMenu = (index: number) => fireEvent.click(actionsButton(index));
const popoverButtons = (index: number) => {
	openMenu(index);
	const popover = document.getElementById(actionsButton(index).getAttribute('aria-controls')!)!;
	return [...within(popover).queryAllByTestId(/^list-picker-item-/)].map(button => button.getAttribute('data-testid'));
};

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

			expect(
				Array.from(root().classList)
					.filter(name => name.startsWith('ui-'))
					.sort(),
			).toEqual(['ui-field', 'ui-list-picker-root']);
			expect(root().hasAttribute('data-input-root')).toBe(true);
			expect(itemsBox().classList.contains('ui-list-picker-items')).toBe(true);
			expect(itemsBox().classList.contains('flex')).toBe(true);
			expect(itemsBox().classList.contains('flex-col')).toBe(true);
			expect(containers()).toHaveLength(2);
			expect(bodies()).toEqual(['a', 'b']);
		});

		it('renders no items box while the list is empty, and renders one when an item arrives', () => {
			const rows = rowsOf();
			mount(rows);
			expect(within(root()).queryByTestId('list-picker-items')).toBeNull();

			act(() => rows.set([{ name: 'a' }]));
			expect(itemsBox()).toBeTruthy();
		});

		it('puts the header before the body, with a numbered title, when the menu bar is not inline', () => {
			mount(rowsOf('a'));

			const children = [...containers()[0].children].map(child => child.className);
			expect(children).toEqual(['ui-list-picker-item-header', 'ui-list-picker-item']);
			expect(within(containers()[0]).getByTestId('list-picker-item-title').textContent).toBe('Target 1');
		});

		it('puts the body first and drops the title when the menu bar is inline', () => {
			mount(rowsOf('a'), { inlineMenuBar: true });

			const children = [...containers()[0].children].map(child => child.className);
			expect(children).toEqual(['ui-list-picker-item', 'ui-list-picker-item-header']);
			expect(within(containers()[0]).queryByTestId('list-picker-item-title')).toBeNull();
			expect(containers()[0].getAttribute('data-layout')).toBe('inline');
		});

		it('carries the kebab-cased item label as a class while the item is draggable', () => {
			mount(rowsOf('a'), { itemLabel: 'Pre-Pull Action' });

			expect(containers()[0].classList.contains('pre-pull-action')).toBe(true);
			expect(containers()[0].hasAttribute('data-draggable')).toBe(true);
		});

		it('folds the layout flags onto the root', () => {
			mount(rowsOf('a'), { isCompact: true, hideUi: true, horizontalLayout: true, extraClassNames: ['targets-picker'] });

			const classes = root().className.split(' ');
			expect(classes).toContain('ui-list-picker-compact');
			expect(classes).toContain('hidden');
			expect(classes).toContain('ui-list-picker-horizontal');
			expect(classes).toContain('targets-picker');
			// horizontalLayout forces the inline menu bar.
			expect(containers()[0].getAttribute('data-layout')).toBe('inline');
		});

		it('renders the title as a span, not a label, and hangs the tooltip button inside it', () => {
			mount(rowsOf('a'), { title: 'Targets', titleTooltip: 'One row per target' });

			const title = within(root()).getByTestId('list-picker-title');
			expect(title.tagName).toBe('SPAN');
			expect(title.textContent).toBe('Targets');
			expect(title.querySelector('button[data-testid="tooltip-button"].ml-2')).not.toBeNull();
		});

		it('renders header extras between the title and the actions button', () => {
			render(
				<ListPicker<Rows, Row>
					modObject={rowsOf('a')}
					config={configFor()}
					renderItem={() => <span data-testid="leaf" />}
					renderItemHeader={index => <i data-testid="hide-picker" data-index={index} />}
				/>,
			);

			const header = within(root()).getByTestId('list-picker-item-header');
			expect([...header.children].map(child => child.getAttribute('data-testid'))).toEqual([
				'list-picker-item-title',
				'hide-picker',
				'list-picker-item-actions',
			]);
		});
	});

	describe('actions', () => {
		it('appends a new item through newItem', () => {
			const rows = rowsOf('a');
			mount(rows);

			fireEvent.click(newButton()!);
			expect(rows.value.map(row => row.name)).toEqual(['a', 'new']);
		});

		it('renders the create button as an icon action when asked', () => {
			mount(rowsOf('a'), { actions: { create: { useIcon: true } } });

			expect(newButton()!.className.split(' ').sort()).toEqual(['text-success', 'ui-list-picker-item-action', 'ui-list-picker-new-button']);
			expect(newButton()!.querySelector('i')!.className).toBe('fa fa-xl fa-plus');
		});

		it('deletes the item at its index', () => {
			const rows = rowsOf('a', 'b', 'c');
			mount(rows);

			openMenu(1);
			fireEvent.click(screen.getByTestId('list-picker-item-delete'));
			expect(rows.value.map(row => row.name)).toEqual(['a', 'c']);
		});

		it('copies the item in beside itself through copyItem', () => {
			const rows = rowsOf('a', 'b');
			mount(rows);

			openMenu(1);
			fireEvent.click(screen.getByTestId('list-picker-item-copy'));
			expect(rows.value.map(row => row.name)).toEqual(['a', 'b', 'b']);
		});

		it('hands copying to onCopyItem when the caller owns it, and writes nothing itself', () => {
			const onCopyItem = vi.fn();
			const rows = rowsOf('a');
			mount(rows, { copyItem: undefined, onCopyItem } as Partial<ListPickerConfig<Rows, Row>>);

			openMenu(0);
			fireEvent.click(screen.getByTestId('list-picker-item-copy'));
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

			expect(within(root()).queryByTestId('list-picker-item-actions')).toBeNull();
			expect(newButton()).toBeNull();
			expect(containers()[0].hasAttribute('data-draggable')).toBe(false);
		});

		it('renders extra actions in the menu, between delete and copy', () => {
			const onClick = vi.fn();
			mount(rowsOf('a'), {
				extraActions: [{ className: 'list-picker-item-extract-variable', icon: 'fa-arrow-right-from-bracket', tooltip: 'Extract', onClick }],
			});

			expect(popoverButtons(0)).toEqual(['list-picker-item-delete', 'list-picker-item-extract-variable', 'list-picker-item-copy']);
			fireEvent.click(screen.getByTestId('list-picker-item-extract-variable'));
			expect(onClick).toHaveBeenCalledWith(0);
		});

		it('leaves out an extra action whose shouldShow refuses the item', () => {
			mount(rowsOf('a', 'b'), {
				extraActions: [
					{ className: 'list-picker-item-extract-variable', icon: 'fa-x', tooltip: 'Extract', onClick: vi.fn(), shouldShow: index => index === 1 },
				],
			});

			expect(popoverButtons(0)).toEqual(['list-picker-item-delete', 'list-picker-item-copy']);
			expect(popoverButtons(1)).toEqual(['list-picker-item-delete', 'list-picker-item-extract-variable', 'list-picker-item-copy']);
		});

		it('opens the menu on hover over the actions button, and closes it once an action is taken', () => {
			mount(rowsOf('a'));
			const popover = () => screen.queryByTestId('list-picker-item-popover');
			expect(popover()).toBeNull();

			fireEvent.mouseEnter(actionsButton(0));
			expect(popover()?.hasAttribute('data-open')).toBe(true);

			fireEvent.click(screen.getByTestId('list-picker-item-copy'));
			expect(popover()?.hasAttribute('data-open') ?? false).toBe(false);
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
						<button data-testid="leaf" onClick={() => itemConfig.setValue(rows, { name: `${index}!` })}>
							{itemConfig.getValue(rows).name}
						</button>
					)}
				/>,
			);
			expect(bodies()).toEqual(['a', 'b']);

			fireEvent.click(root().querySelectorAll('[data-testid="leaf"]')[1]);
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
			mount(rowsOf('a'), {}, () => <input data-testid="leaf" />);
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

		it('moves an item down to the row it is dropped on, not one past it', () => {
			const rows = rowsOf('a', 'b', 'c');
			mount(rows);

			startDrag(0);
			dropOn(2);
			expect(rows.value.map(row => row.name)).toEqual(['b', 'a', 'c']);
		});

		it('writes nothing for a drop just below the dragged item', () => {
			const rows = rowsOf('a', 'b', 'c');
			mount(rows);

			startDrag(0);
			dropOn(1);
			expect(rows.writes).toBe(0);
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
			expect(containers()[0].getAttribute('data-drag')).toBe('from');
			act(() => void fireEvent.dragEnter(containers()[1], { dataTransfer: dataTransfer() }));
			expect(containers()[1].getAttribute('data-drag')).toBe('to');

			act(() => void fireEvent.dragEnd(containers()[0], { dataTransfer: dataTransfer() }));
			expect(containers()[0].hasAttribute('data-drag')).toBe(false);
			expect(containers()[1].hasAttribute('data-drag')).toBe(false);
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
							renderItem={(index, itemConfig) => <span data-testid="leaf">{itemConfig.getValue(left).name}</span>}
						/>
					</div>
					<div id="right">
						<ListPicker<Rows, Row>
							modObject={right}
							config={configFor(rightExtra)}
							renderItem={(index, itemConfig) => <span data-testid="leaf">{itemConfig.getValue(right).name}</span>}
						/>
					</div>
				</>,
			);

		const boxes = (side: string) => within(document.getElementById(side)!).queryAllByTestId('list-picker-item-container');

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

	describe('stable identity through reorders', () => {
		const MemoRow = memo(({ rows, itemConfig, onMount }: { rows: Rows; itemConfig: ListItemPickerConfig<Rows, Row>; onMount?: () => void }) => {
			useEffect(() => {
				onMount?.();
			}, [onMount]);
			const value = useStoreSubscribe(itemConfig.storeSubscribe!(rows), () => itemConfig.getValue(rows));
			return (
				<div data-testid="memo-row">
					<span data-testid="memo-name">{value?.name}</span>
					<input data-testid="memo-input" value={value?.name ?? ''} onChange={event => itemConfig.setValue(rows, { name: event.target.value })} />
				</div>
			);
		});

		const mountMemo = (rows: Rows, onMount?: () => void) =>
			render(
				<ListPicker<Rows, Row>
					modObject={rows}
					config={configFor({ storeSubscribe: (subject: Rows) => subject.subscribe })}
					renderItem={(_index, itemConfig) => <MemoRow rows={rows} itemConfig={itemConfig} onMount={onMount} />}
				/>,
			);

		const names = () =>
			within(root())
				.queryAllByTestId('memo-name')
				.map(node => node.textContent);
		const inputs = () => within(root()).queryAllByTestId('memo-input') as Array<HTMLInputElement>;
		const cloneRow = (row: Row): Row => ({ ...row });

		it('keeps every row, including a memoized store-subscribed child, reading its own object after a reorder', () => {
			const rows = rowsOf('a', 'b', 'c');
			mountMemo(rows);
			expect(names()).toEqual(['a', 'b', 'c']);

			startDrag(2);
			dropOn(0);

			expect(rows.value.map(row => row.name)).toEqual(['c', 'a', 'b']);
			expect(names()).toEqual(['c', 'a', 'b']);
		});

		it('edits the moved item through its own child config, and only that object changes', () => {
			const rows = rowsOf('a', 'b', 'c');
			mountMemo(rows);

			startDrag(2);
			dropOn(0);
			expect(names()).toEqual(['c', 'a', 'b']);

			fireEvent.change(inputs()[0], { target: { value: 'c!' } });
			expect(rows.value.map(row => row.name)).toEqual(['c!', 'a', 'b']);
		});

		it('replaces an item through setValue without remounting it', () => {
			const rows = rowsOf('a');
			let mountCount = 0;
			mountMemo(rows, () => mountCount++);
			expect(mountCount).toBe(1);

			fireEvent.change(inputs()[0], { target: { value: 'a2' } });

			expect(mountCount).toBe(1);
			expect(rows.value.map(row => row.name)).toEqual(['a2']);
		});

		it('does not remount any row when one item is replaced in place by a clone at the same index', () => {
			const rows = rowsOf('a', 'b', 'c');
			let mountCount = 0;
			mountMemo(rows, () => mountCount++);
			expect(mountCount).toBe(3);

			act(() => rows.set([rows.value[0], cloneRow(rows.value[1]), rows.value[2]]));

			expect(mountCount).toBe(3);
			expect(names()).toEqual(['a', 'b', 'c']);
		});

		it('does not remount any row when the whole list is replaced by clones at the same positions', () => {
			const rows = rowsOf('a', 'b', 'c');
			let mountCount = 0;
			mountMemo(rows, () => mountCount++);
			expect(mountCount).toBe(3);

			act(() => rows.set(rows.value.map(cloneRow)));

			expect(mountCount).toBe(3);
			expect(names()).toEqual(['a', 'b', 'c']);
		});

		it('a stale itemConfig captured before a reorder still reaches its own item after the reorder', () => {
			const rows = rowsOf('a', 'b', 'c');
			let staleConfig: ListItemPickerConfig<Rows, Row> | null = null;
			render(
				<ListPicker<Rows, Row>
					modObject={rows}
					config={configFor()}
					renderItem={(_index, itemConfig) => {
						staleConfig ??= itemConfig;
						return <span data-testid="leaf">{itemConfig.getValue(rows).name}</span>;
					}}
				/>,
			);
			expect(staleConfig!.getValue(rows).name).toBe('a');

			startDrag(2);
			dropOn(0);
			expect(rows.value.map(row => row.name)).toEqual(['c', 'a', 'b']);

			expect(staleConfig!.getValue(rows).name).toBe('a');

			staleConfig!.setValue(rows, { name: 'a!' });
			expect(rows.value.map(row => row.name)).toEqual(['c', 'a!', 'b']);
		});

		it('keeps ids unique and stable through copy, delete and a further move', () => {
			const rows = rowsOf('a', 'b');
			mountMemo(rows);

			openMenu(1);
			fireEvent.click(within(document.getElementById(actionsButton(1).getAttribute('aria-controls')!)!).getByTestId('list-picker-item-copy'));
			expect(rows.value.map(row => row.name)).toEqual(['a', 'b', 'b']);
			expect(names()).toEqual(['a', 'b', 'b']);

			openMenu(0);
			fireEvent.click(within(document.getElementById(actionsButton(0).getAttribute('aria-controls')!)!).getByTestId('list-picker-item-delete'));
			expect(rows.value.map(row => row.name)).toEqual(['b', 'b']);

			startDrag(1);
			dropOn(0);
			expect(rows.value.map(row => row.name)).toEqual(['b', 'b']);
			expect(names()).toEqual(['b', 'b']);

			fireEvent.change(inputs()[1], { target: { value: 'second' } });
			expect(rows.value.map(row => row.name)).toEqual(['b', 'second']);
		});
	});

	describe('showWhen and enableWhen', () => {
		it('unmounts the whole list when showWhen says no', () => {
			mount(rowsOf('a'), { showWhen: () => false });

			expect(screen.queryByTestId('list-picker-root')).toBeNull();
			expect(screen.queryAllByTestId('list-picker-item-container')).toHaveLength(0);
		});

		it('adds disabled when enableWhen says no', () => {
			mount(rowsOf('a'), { enableWhen: () => false });

			expect(root().hasAttribute('data-disabled')).toBe(true);
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

		expect(screen.getByTestId('list-picker-new-button').getAttribute('type')).toBe('button');
	});
});
