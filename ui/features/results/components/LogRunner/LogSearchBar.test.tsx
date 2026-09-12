import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_SUGGESTIONS } from '../../model/log/search/indexes';
import { LogSearchBar } from './LogSearchBar';
import type { IdentifiedSearchGroup } from './utils';

// The card itself is `LogSearchGroup`'s test; here it only has to be countable and addressable.
vi.mock('./LogSearchGroup', () => ({
	LogSearchGroup: ({
		group,
		onChange,
		onRemove,
	}: {
		group: IdentifiedSearchGroup;
		onChange: (next: IdentifiedSearchGroup) => void;
		onRemove: () => void;
	}) => (
		<div className="log-search-group" data-field={group.field} data-id={group.id}>
			<button type="button" data-edit={group.field} onClick={() => onChange({ ...group, join: 'and' })} />
			<button type="button" data-remove={group.field} onClick={onRemove} />
		</div>
	),
}));

const mount = (groups: Array<IdentifiedSearchGroup>, onChange = vi.fn()) => ({
	onChange,
	...render(<LogSearchBar groups={groups} suggestions={EMPTY_SUGGESTIONS} onChange={onChange} />),
});

const group = (id: number, field: IdentifiedSearchGroup['field']): IdentifiedSearchGroup => ({ id, field, join: 'or', values: [] });

const openAddField = async (container: HTMLElement) =>
	act(() => void fireEvent.click(container.querySelector<HTMLButtonElement>('.log-search-add-field .dropdown-picker-button')!));

describe('LogSearchBar', () => {
	it('renders a card per group and the add-filter picker after them', () => {
		const { container } = mount([group(0, 'source'), group(1, 'spell')]);

		expect([...container.querySelectorAll('.log-search-groups .log-search-group')].map(card => card.getAttribute('data-field'))).toEqual([
			'source',
			'spell',
		]);
		// i18n has no bundle loaded under vitest, so a key that resolves to itself is the label landing.
		expect(container.querySelector('.log-search-add-field .dropdown-picker-button')!.textContent).toBe('results_tab.details.logs.search_add_filter');
	});

	it('offers every field the query language has', async () => {
		const { container } = mount([]);
		await openAddField(container);

		expect([...container.querySelectorAll('.dropdown-picker-item')].map(item => item.textContent)).toEqual([
			'Source',
			'Target',
			'Spell',
			'Type',
			'School',
			'Outcome',
			'Time',
			'Amount',
		]);
	});

	it('appends a new empty OR group for the field that was picked', async () => {
		const { container, onChange } = mount([]);
		await openAddField(container);
		await act(() => void fireEvent.click([...container.querySelectorAll<HTMLElement>('.dropdown-picker-item')][2]));

		expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ field: 'spell', join: 'or', values: [] })]);
	});

	// The id is what lets React keep a group's half-typed value when an earlier group is deleted, so
	// two groups must never share one.
	it('hands every group it adds its own id', async () => {
		let groups: Array<IdentifiedSearchGroup> = [];
		const onChange = vi.fn((next: Array<IdentifiedSearchGroup>) => (groups = next));
		const { container, rerender } = render(<LogSearchBar groups={groups} suggestions={EMPTY_SUGGESTIONS} onChange={onChange} />);

		for (let round = 0; round < 2; round++) {
			await openAddField(container);
			await act(() => void fireEvent.click(container.querySelector<HTMLElement>('.dropdown-picker-item')!));
			rerender(<LogSearchBar groups={groups} suggestions={EMPTY_SUGGESTIONS} onChange={onChange} />);
		}

		expect(new Set(groups.map(added => added.id)).size).toBe(2);
	});

	it('replaces only the group that changed', () => {
		const { container, onChange } = mount([group(0, 'source'), group(1, 'spell')]);

		fireEvent.click(container.querySelector<HTMLButtonElement>('[data-edit=spell]')!);

		expect(onChange).toHaveBeenCalledWith([
			expect.objectContaining({ field: 'source', join: 'or' }),
			expect.objectContaining({ field: 'spell', join: 'and' }),
		]);
	});

	it('removes only the group that asked to go', () => {
		const { container, onChange } = mount([group(0, 'source'), group(1, 'spell'), group(2, 'type')]);

		fireEvent.click(container.querySelector<HTMLButtonElement>('[data-remove=spell]')!);

		expect(onChange).toHaveBeenCalledWith([expect.objectContaining({ field: 'source' }), expect.objectContaining({ field: 'type' })]);
	});
});
