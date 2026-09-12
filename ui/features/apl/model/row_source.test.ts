import { APLListItem } from '@generated/proto/apl';
import { describe, expect, it, vi } from 'vitest';

import { rowSource } from './row_source';

const upstreamSource = () => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		subscribe: (onChange: () => void) => {
			listeners.add(onChange);
			return () => listeners.delete(onChange);
		},
		notify: () => Array.from(listeners).forEach(listener => listener()),
	};
};

const row = (sequenceName: string, uuid?: string) =>
	APLListItem.create({
		action: {
			condition: { value: { oneofKind: 'const', const: { val: '1s' } }, ...(uuid ? { uuid: { value: uuid } } : {}) },
			action: { oneofKind: 'resetSequence', resetSequence: { sequenceName } },
		},
	});

const setup = (rows: Array<APLListItem>, index = 0) => {
	const upstream = upstreamSource();
	const listener = vi.fn();
	const unsubscribe = rowSource(upstream.subscribe, () => rows[index])(listener);
	return { upstream, listener, unsubscribe };
};

describe('rowSource', () => {
	it('relays an edit made in place on its own row', () => {
		const rows = [row('a')];
		const { upstream, listener } = setup(rows);

		rows[0].hide = true;
		upstream.notify();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('stays silent when a different row changes', () => {
		const rows = [row('a'), row('b')];
		const { upstream, listener } = setup(rows);

		rows[1].hide = true;
		upstream.notify();

		expect(listener).not.toHaveBeenCalled();
	});

	it('stays silent when its row is replaced by an equal copy, and hands the copy its uuids', () => {
		const rows = [row('a', 'kept')];
		const { upstream, listener } = setup(rows);

		rows[0] = row('a');
		upstream.notify();

		expect(listener).not.toHaveBeenCalled();
		expect(rows[0].action?.condition?.uuid?.value).toBe('kept');
	});

	it('keeps a uuid the replacement already carries', () => {
		const rows = [row('a', 'old')];
		const { upstream } = setup(rows);

		rows[0] = row('a', 'new');
		upstream.notify();

		expect(rows[0].action?.condition?.uuid?.value).toBe('new');
	});

	it('relays a replacement whose content differs', () => {
		const rows = [row('a')];
		const { upstream, listener } = setup(rows);

		rows[0] = row('b');
		upstream.notify();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('relays an edit to a copy it stayed silent for', () => {
		const rows = [row('a')];
		const { upstream, listener } = setup(rows);

		rows[0] = row('a');
		upstream.notify();
		rows[0].hide = true;
		upstream.notify();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('relays a row moving out from under its index', () => {
		const rows = [row('a'), row('b')];
		const { upstream, listener } = setup(rows);

		rows.splice(0, 1);
		upstream.notify();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('relays its row disappearing', () => {
		const rows = [row('a')];
		const { upstream, listener } = setup(rows);

		rows.length = 0;
		upstream.notify();

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it('holds one upstream subscription, released with its last listener', () => {
		const rows = [row('a')];
		const upstream = upstreamSource();
		const source = rowSource(upstream.subscribe, () => rows[0]);

		const first = source(() => {});
		const second = source(() => {});
		expect(upstream.listeners.size).toBe(1);

		first();
		expect(upstream.listeners.size).toBe(1);
		second();
		expect(upstream.listeners.size).toBe(0);
	});
});
