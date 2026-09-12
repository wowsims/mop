import type { StoreSubscribe } from '@sim/state/subscriptions';

const withoutUuid = (key: string, value: unknown) => (key === 'uuid' ? undefined : value);

const contentOf = (row: unknown): string => JSON.stringify(row, withoutUuid) ?? '';

const carryUuids = (from: any, to: any) => {
	if (!from || !to || typeof from !== 'object' || typeof to !== 'object') return;
	if (from.uuid?.value && !to.uuid?.value) to.uuid = { value: from.uuid.value };
	for (const key of Object.keys(to)) if (key !== 'uuid') carryUuids(from[key], to[key]);
};

/**
 * `upstream`, passed on only when this row's content moved: with every picker on the rotation
 * itself, loading a rotation re-rendered all of them for a one-row difference. A load clones, so rows
 * compare by content, and a skipped row inherits the replaced row's uuids because only a render mints
 * them.
 */
export const rowSource = (upstream: StoreSubscribe, readRow: () => unknown): StoreSubscribe => {
	const listeners = new Set<() => void>();
	let row = readRow();
	let content = contentOf(row);
	let release: (() => void) | undefined;

	const onUpstream = () => {
		const next = readRow();
		const nextContent = contentOf(next);
		const previous = next === row ? content : contentOf(row);
		if (next !== row && nextContent === previous) carryUuids(row, next);
		row = next;
		content = nextContent;
		if (nextContent !== previous) Array.from(listeners).forEach(listener => listener());
	};

	return onChange => {
		if (!release) {
			row = readRow();
			content = contentOf(row);
			release = upstream(onUpstream);
		}
		listeners.add(onChange);
		return () => {
			listeners.delete(onChange);
			if (listeners.size || !release) return;
			release();
			release = undefined;
		};
	};
};
