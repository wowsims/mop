import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReplayClock } from './useReplayClock';
import { useReplayClock } from './useReplayClock';

let frames: Array<(timestamp: number) => void> = [];
let cancelled: Array<number> = [];

const advance = (timestamp: number) => {
	const due = frames;
	frames = [];
	act(() => due.forEach(callback => callback(timestamp)));
};

let clock: ReplayClock;
let painted: Array<number>;

const Probe = ({ duration }: { duration: number }) => {
	clock = useReplayClock(duration);
	useEffect(() => clock.frames.subscribe(time => painted.push(time)), []);
	return null;
};

const mount = (duration = 10) => render(<Probe duration={duration} />);

beforeEach(() => {
	frames = [];
	cancelled = [];
	painted = [];
	vi.stubGlobal('requestAnimationFrame', (callback: (timestamp: number) => void) => frames.push(callback));
	vi.stubGlobal('cancelAnimationFrame', (handle: number) => cancelled.push(handle));
});

afterEach(() => vi.unstubAllGlobals());

describe('useReplayClock', () => {
	it('starts stopped at the beginning', () => {
		mount();
		expect(clock.playing).toBe(false);
		expect(clock.frames.getTime()).toBe(0);
		expect(frames).toHaveLength(0);
	});

	it('paints every painter on a seek', () => {
		mount();
		act(() => clock.seekTo(4));
		expect(clock.frames.getTime()).toBe(4);
		expect(painted).toEqual([4]);
	});

	it('clamps a seek to the fight', () => {
		mount(10);
		act(() => clock.seekTo(-5));
		expect(clock.frames.getTime()).toBe(0);
		act(() => clock.seekTo(99));
		expect(clock.frames.getTime()).toBe(10);
	});

	it('seeks relative to where it is', () => {
		mount();
		act(() => clock.seekTo(4));
		act(() => clock.seekBy(2));
		expect(clock.frames.getTime()).toBe(6);
	});

	it('advances at wall-clock speed once playing', () => {
		mount();
		act(() => clock.play());
		expect(clock.playing).toBe(true);
		// The first frame only takes a reading; the second is the first with an interval to apply.
		advance(1000);
		expect(clock.frames.getTime()).toBe(0);
		advance(1500);
		expect(clock.frames.getTime()).toBe(0.5);
	});

	it('multiplies the interval by the rate', () => {
		mount();
		act(() => clock.setRate(3));
		act(() => clock.play());
		advance(1000);
		advance(1500);
		expect(clock.frames.getTime()).toBe(1.5);
	});

	it('stops requesting frames once paused', () => {
		mount();
		act(() => clock.play());
		advance(1000);
		act(() => clock.pause());
		expect(clock.playing).toBe(false);
		expect(cancelled).toHaveLength(1);
	});

	it('lands exactly on the end of the fight and stops there', () => {
		mount(1);
		act(() => clock.play());
		advance(1000);
		advance(3000);
		expect(clock.frames.getTime()).toBe(1);
		expect(clock.playing).toBe(false);
		expect(frames).toHaveLength(0);
	});

	it('restarts a finished fight rather than sitting at the end', () => {
		mount(1);
		act(() => clock.seekTo(1));
		act(() => clock.play());
		expect(clock.frames.getTime()).toBe(0);
		expect(clock.playing).toBe(true);
	});

	it('drops a painter that has gone away', () => {
		const view = mount();
		act(() => clock.seekTo(1));
		view.unmount();
		act(() => clock.seekTo(2));
		expect(painted).toEqual([1]);
	});
});
