import { act, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { ReplayFrames, ReplayPainter } from './useReplayClock';
import { ReplayFramesContext, useFrameList, useReplayFrame } from './useReplayFrame';

let time = 0;
let painters: Set<ReplayPainter>;

const frames: ReplayFrames = {
	getTime: () => time,
	subscribe: paint => {
		painters.add(paint);
		return () => {
			painters.delete(paint);
		};
	},
};

const tick = (next: number) => {
	time = next;
	act(() => painters.forEach(paint => paint(next)));
};

const Stage = ({ children }: { children: ReactNode }) => <ReplayFramesContext value={frames}>{children}</ReplayFramesContext>;

beforeEach(() => {
	time = 0;
	painters = new Set();
});

describe('useReplayFrame', () => {
	it('paints on every tick', () => {
		const seen: Array<number> = [];
		const Painter = () => {
			useReplayFrame(at => seen.push(at));
			return null;
		};
		render(
			<Stage>
				<Painter />
			</Stage>,
		);
		seen.length = 0;
		tick(3);
		tick(4);
		expect(seen).toEqual([3, 4]);
	});

	// The one that is not obvious: while the replay is paused there is no next tick, so a leaf that
	// mounts or changes on a seek has to be painted by the render itself.
	it('paints a leaf that arrives between ticks, without waiting for one', () => {
		const seen: Array<number> = [];
		const Painter = () => {
			useReplayFrame(at => seen.push(at));
			return null;
		};
		const Host = () => {
			const [shown, setShown] = useState(false);
			useReplayFrame(() => setShown(true));
			return shown ? <Painter /> : null;
		};

		time = 7;
		render(
			<Stage>
				<Host />
			</Stage>,
		);
		expect(seen).toEqual([7]);
	});

	it('repaints when its own props change, without waiting for a tick', () => {
		const seen: Array<string> = [];
		const Painter = ({ label }: { label: string }) => {
			useReplayFrame(at => seen.push(`${label}@${at}`));
			return null;
		};
		const view = render(
			<Stage>
				<Painter label="a" />
			</Stage>,
		);
		time = 2;
		view.rerender(
			<Stage>
				<Painter label="b" />
			</Stage>,
		);
		expect(seen).toEqual(['a@0', 'b@2']);
	});

	it('stops painting once it is gone', () => {
		const seen: Array<number> = [];
		const Painter = () => {
			useReplayFrame(at => seen.push(at));
			return null;
		};
		const view = render(
			<Stage>
				<Painter />
			</Stage>,
		);
		view.unmount();
		tick(5);
		expect(seen).toEqual([0]);
		expect(painters.size).toBe(0);
	});
});

describe('useFrameList', () => {
	// Two runs whose lists have the same keys but different entries: what the guard has to notice is
	// the run changing, not just the list turning over.
	const firstRun = [
		{ id: 'a', tag: 'A1' },
		{ id: 'b', tag: 'A2' },
		{ id: 'c', tag: 'A3' },
	];
	const secondRun = firstRun.map(item => ({ id: item.id, tag: item.tag.replace('A', 'B') }));
	let renders = 0;

	const List = ({ from }: { from: Array<{ id: string; tag: string }> }) => {
		renders++;
		const items = useFrameList(
			from,
			at => from.slice(0, Math.floor(at)),
			item => item.id,
		);
		return <div data-testid="list">{items.map(item => item.tag).join(',')}</div>;
	};

	const first = (
		<Stage>
			<List from={firstRun} />
		</Stage>
	);
	const second = (
		<Stage>
			<List from={secondRun} />
		</Stage>
	);

	beforeEach(() => {
		renders = 0;
	});

	it('commits the list the playhead decides on', () => {
		const view = render(first);
		tick(2);
		expect(view.getByTestId('list').textContent).toBe('A1,A2');
	});

	it('does not re-render on a tick that leaves the list alone', () => {
		render(first);
		tick(2);
		const settled = renders;
		tick(2.2);
		tick(2.4);
		tick(2.6);
		expect(renders).toBe(settled);
	});

	it('rebuilds when a new run produces a list with the same keys', () => {
		const view = render(first);
		tick(2);
		view.rerender(second);
		expect(view.getByTestId('list').textContent).toBe('B1,B2');
	});
});
