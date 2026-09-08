import { render } from '@testing-library/react';
import { act, useSyncExternalStore } from 'react';
import { describe, expect, it } from 'vitest';

import type { SimResultData } from './result_data';
import { ResultChannel } from './result_channel';

const resultData = (label: string) => ({ result: { label }, filter: {} }) as unknown as SimResultData;

describe('ResultChannel', () => {
	it('has no snapshot before the first emit', () => {
		expect(new ResultChannel().getSnapshot()).toBeNull();
	});

	it('replays the last emitted value, as the same object every time', () => {
		const channel = new ResultChannel();
		const first = resultData('first');
		channel.emit(first);

		expect(channel.getSnapshot()).toBe(first);
		expect(channel.getSnapshot()).toBe(channel.getSnapshot());

		const second = resultData('second');
		channel.emit(second);
		expect(channel.getSnapshot()).toBe(second);

		channel.emit(null);
		expect(channel.getSnapshot()).toBeNull();
	});

	it('notifies both listener shapes exactly once per emit', () => {
		const channel = new ResultChannel();
		const values: Array<SimResultData | null> = [];
		let notifications = 0;
		channel.on(value => values.push(value));
		channel.subscribe(() => notifications++);

		const one = resultData('one');
		channel.emit(one);
		channel.emit(null);

		expect(values).toEqual([one, null]);
		expect(notifications).toBe(2);
	});

	it('stops delivering after unsubscribe', () => {
		const channel = new ResultChannel();
		let notifications = 0;
		const unsubscribe = channel.subscribe(() => notifications++);

		channel.emit(resultData('before'));
		unsubscribe();
		channel.emit(resultData('after'));

		expect(notifications).toBe(1);
	});

	// The reason `getSnapshot` returns a stored field rather than building a value: React reads a new
	// snapshot identity as a change, so an unstable one re-renders without end. This is also the
	// `ResultComponent.lastSimResult` replay — a consumer that mounts after the run still sees it.
	it('feeds useSyncExternalStore one render per emit, replaying a run that already finished', () => {
		const channel = new ResultChannel();
		const first = resultData('first');
		channel.emit(first);

		let renders = 0;
		const seen: Array<SimResultData | null> = [];
		const Probe = () => {
			const snapshot = useSyncExternalStore(channel.subscribe, channel.getSnapshot);
			renders++;
			seen.push(snapshot);
			return <span>{String(snapshot)}</span>;
		};

		render(<Probe />);
		expect(seen.at(-1)).toBe(first);
		const afterMount = renders;

		const second = resultData('second');
		act(() => channel.emit(second));
		expect(seen.at(-1)).toBe(second);
		expect(renders).toBe(afterMount + 1);

		act(() => channel.emit(null));
		expect(seen.at(-1)).toBeNull();
		expect(renders).toBe(afterMount + 2);
	});
});
