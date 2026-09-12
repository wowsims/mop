// The batch importer's `onImport` is the whole of it: what reaches `addItems`, and what a bad payload
// does — a throw, which the shell turns into the error toast.
import { EquipmentSpec, ItemSpec } from '@generated/proto/common';
import { fakeHost } from '@sim/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadLeftovers = vi.hoisted(() => vi.fn());
const addItems = vi.hoisted(() => vi.fn());
vi.mock('@sim/proto/database', () => ({ Database: { loadLeftoversIfNecessary: loadLeftovers } }));
vi.mock('@features/bulk/model/items', () => ({ addBulkItems: addItems }));

import { BULK_GEAR_IMPORTER } from './bulk_gear';

const KNOWN_ITEM = 1;
// Survives the `id > 0` test and then fails the lookup, which is the second half of the filter.
const UNKNOWN_ITEM = 3;
const host = fakeHost();

const json = (...ids: number[]) => EquipmentSpec.toJsonString(EquipmentSpec.create({ items: ids.map(id => ItemSpec.create({ id })) }));

beforeEach(() => {
	addItems.mockClear();
	loadLeftovers.mockReset().mockResolvedValue({ lookupItemSpec: (spec: ItemSpec) => (spec.id === KNOWN_ITEM ? {} : null) });
});

describe('BULK_GEAR_IMPORTER', () => {
	it('adds the items the database knows', async () => {
		await BULK_GEAR_IMPORTER.onImport(host, json(KNOWN_ITEM, 0, UNKNOWN_ITEM));

		expect(addItems).toHaveBeenCalledTimes(1);
		expect(addItems.mock.calls[0][1].map((spec: ItemSpec) => spec.id)).toEqual([KNOWN_ITEM]);
	});

	it('adds nothing when the database knows none of them', async () => {
		await BULK_GEAR_IMPORTER.onImport(host, json(UNKNOWN_ITEM));

		expect(addItems).not.toHaveBeenCalled();
	});

	// An empty export must not reach the database at all — the leftover load is a fetch.
	it('does not load leftovers for an export with no items', async () => {
		await BULK_GEAR_IMPORTER.onImport(host, json());

		expect(loadLeftovers).not.toHaveBeenCalled();
		expect(addItems).not.toHaveBeenCalled();
	});

	it('throws on a payload that is not an equipment export', async () => {
		await expect(BULK_GEAR_IMPORTER.onImport(host, 'not json')).rejects.toThrow();
		expect(addItems).not.toHaveBeenCalled();
	});
});
