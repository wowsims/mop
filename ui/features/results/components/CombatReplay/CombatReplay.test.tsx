import { ResourceType } from '@generated/proto/spell';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReplayModel } from '../../model/replay';
import type { SimResultData } from '../../model/result_data';
import { replayAction, replayAura, replayEnemy, replayHit, replayModel, resourceRow } from './testing';

vi.mock('@sim/proto/action_id/dom', () => ({ actionIdWowheadTooltipData: () => Promise.resolve('spell=1') }));

let result: SimResultData | null = null;
let model: ReplayModel;
let built = 0;

vi.mock('../../hooks/useSimResult', () => ({ useSimResult: () => result }));
vi.mock('../../model/replay', async importOriginal => ({
	...(await importOriginal<typeof import('../../model/replay')>()),
	buildReplayModel: () => {
		built++;
		return model;
	},
}));

const { CombatReplay } = await import('./CombatReplay');

let frames: Map<number, (timestamp: number) => void>;
let nextHandle = 0;

/** Delivers every frame that is due, the way a browser would: a cancelled one never arrives. */
const step = (timestamp: number) => {
	const due = [...frames.values()];
	frames.clear();
	due.forEach(callback => callback(timestamp));
};

const mount = (active = true) => render(<CombatReplay active={active} />).container;

const seek = (container: HTMLElement, time: number) => {
	const scrubber = container.querySelector<HTMLInputElement>('.cr-scrubber')!;
	fireEvent.change(scrubber, { target: { value: String(Math.round((time / model.duration) * 1000)) } });
};

const texts = (container: HTMLElement, selector: string) => [...container.querySelectorAll(selector)].map(element => element.textContent);

beforeEach(() => {
	frames = new Map();
	nextHandle = 0;
	built = 0;
	result = { result: {}, filter: {} } as SimResultData;
	model = replayModel({
		duration: 100,
		actions: [replayAction(1, 'Bolt', { dmg: 1500, isCrit: true }), replayAction(2, 'Shot', { dmg: 400 }), replayAction(10, 'Bolt')],
		uniqueActions: [replayAction(1, 'Bolt'), replayAction(2, 'Shot')],
		playerAuras: [replayAura(1, 5, 'Fury', [{ timestamp: 1, newStacks: 3 }]), replayAura(1, 20, 'Focus')],
		enemies: [replayEnemy(0, 'Boss', [replayHit(1, 100), replayHit(2, 300, true)], [replayAura(1, 8, 'Rend')]), replayEnemy(1, 'Add', [replayHit(2, 200)])],
		resourceRows: [
			resourceRow({
				samples: [
					{ time: 1, value: 60 },
					{ time: 3, value: 20 },
				],
			}),
			resourceRow({ type: ResourceType.ResourceTypeComboPoints, label: 'Combo Points', maxValue: 5, segmented: true, samples: [{ time: 1, value: 3 }] }),
		],
	});
	vi.stubGlobal('requestAnimationFrame', (callback: (timestamp: number) => void) => {
		frames.set(++nextHandle, callback);
		return nextHandle;
	});
	vi.stubGlobal('cancelAnimationFrame', (handle: number) => frames.delete(handle));
	vi.stubGlobal('Image', class {});
});

afterEach(() => vi.unstubAllGlobals());

describe('CombatReplay', () => {
	it('asks for a run before it has one', () => {
		result = null;
		const container = mount();
		expect(container.querySelector('.cr-empty-title')!.textContent).toBe('combat_replay.empty_title');
		expect(container.querySelector('.cr-scene')).toBeNull();
	});

	it('holds a finished run until its tab is opened', () => {
		const container = mount(false);
		expect(container.querySelector('.cr-scene')).toBeNull();
		expect(built).toBe(0);
	});

	it('builds the scene once its tab is open', () => {
		const container = mount();
		expect(container.querySelector('.cr-scene')).not.toBeNull();
		expect(container.querySelector('.cr-cdm-player-label')!.textContent).toBe('Hero');
		expect(built).toBe(1);
	});

	it('starts at the beginning of the fight', () => {
		const container = mount();
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:00.0 / 1:40.0');
		expect(container.querySelector<HTMLInputElement>('.cr-scrubber')!.value).toBe('0');
		expect(container.querySelectorAll('.cr-strip-icon')).toHaveLength(0);
	});

	it('walks the cast strip forward, badging what each cast landed', () => {
		const container = mount();
		seek(container, 2.4);

		const icons = [...container.querySelectorAll<HTMLElement>('.cr-strip-icon')];
		expect(icons).toHaveLength(2);
		expect(icons[0].className).toBe('cr-strip-icon');
		expect(icons[1].className).toBe('cr-strip-icon cr-strip-icon-active');
		expect(icons[0].style.opacity).toBe('0.25');
		expect(icons[1].style.opacity).toBe('1');
		expect(texts(container, '.cr-crit-badge')).toEqual(['!']);
		expect(texts(container, '.cr-dmg-badge')).toEqual(['1.5k', '400']);
	});

	it('runs the cast bar over the gap to the next cast', () => {
		const container = mount();
		seek(container, 6);
		expect(container.querySelector<HTMLElement>('.cr-cast-bar-fill')!.style.width).toBe('50%');
		expect(container.querySelector('.cr-cast-bar-label')!.textContent).toBe('Shot');
		expect(container.querySelector('.cr-cast-bar-time')!.textContent).toBe('4.0s');
	});

	it('lights the action grid for the spell just cast', () => {
		const container = mount();
		seek(container, 2.1);
		expect([...container.querySelectorAll('.cr-action-icon')].map(icon => icon.className)).toEqual([
			'cr-action-icon',
			'cr-action-icon cr-action-icon-active',
		]);
	});

	it('shows the buffs that are up, counting down and stacked', () => {
		const container = mount();
		seek(container, 3);

		const buffs = container.querySelector('.cr-buff-icons')!;
		expect(buffs.querySelectorAll('.cr-aura-icon')).toHaveLength(2);
		expect(texts(buffs as HTMLElement, '.cr-aura-time-badge')).toEqual(['2.0', '17']);
		expect(texts(buffs as HTMLElement, '.cr-aura-stack-badge')).toEqual(['3', '']);

		seek(container, 6);
		expect(buffs.querySelectorAll('.cr-aura-icon')).toHaveLength(1);
	});

	it('draws one card per enemy, each with its own debuffs and health', () => {
		const container = mount();
		seek(container, 2);

		const cards = [...container.querySelectorAll<HTMLElement>('.cr-enemy-card')];
		expect(cards.map(card => card.querySelector('.cr-enemy-name')!.textContent)).toEqual(['Boss', 'Add']);
		expect(cards.map(card => card.querySelector<HTMLElement>('.cr-hp-fill')!.style.width)).toEqual(['0%', '0%']);
		expect(cards[0].querySelectorAll('.cr-debuff-row .cr-aura-icon')).toHaveLength(1);
		expect(cards[1].querySelectorAll('.cr-debuff-row .cr-aura-icon')).toHaveLength(0);

		seek(container, 1);
		expect(cards[0].querySelector<HTMLElement>('.cr-hp-fill')!.style.width).toBe('75%');
		expect(cards[0].querySelector('.cr-hp-text')!.textContent).toBe('75.0%');
	});

	it('places the cards in the formation the model asked for', () => {
		const container = mount();
		const first = container.querySelector<HTMLElement>('.cr-enemy-card')!;
		expect(first.style.getPropertyValue('--cr-card-x')).toBe('25%');
		expect(first.style.getPropertyValue('--cr-card-w')).toBe('40%');
		expect(first.style.getPropertyValue('--cr-card-scale')).toBe('1.000');
	});

	it('fills the hit layer only while a hit is fresh', () => {
		const container = mount();
		const layer = container.querySelector('.cr-hit-layer')!;
		seek(container, 1);
		expect(layer.querySelectorAll('.cr-hit-effect')).toHaveLength(1);
		expect(layer.querySelector('.cr-dmg-num')!.textContent).toBe('100');
		seek(container, 2);
		expect(layer.querySelectorAll('.cr-hit-effect')).toHaveLength(2);
		seek(container, 5);
		expect(layer.querySelectorAll('.cr-hit-effect')).toHaveLength(0);
	});

	it('holds each resource at the value the log last left', () => {
		const container = mount();
		seek(container, 2);
		expect(container.querySelector<HTMLElement>('.cr-res-bar-fill')!.style.width).toBe('60%');
		expect(container.querySelector('.cr-bar-val')!.textContent).toBe('60/100');
		expect(container.querySelector('.cr-dot-val')!.textContent).toBe('3/5');
		expect([...container.querySelectorAll('.cr-segment')].map(pip => pip.className)).toEqual([
			'cr-segment cr-segment--filled',
			'cr-segment cr-segment--filled',
			'cr-segment cr-segment--filled',
			'cr-segment cr-segment--empty',
			'cr-segment cr-segment--empty',
		]);
	});

	it('seeks by the step the button carries', () => {
		const container = mount();
		const buttons = [...container.querySelectorAll<HTMLButtonElement>('.cr-ctrl-btn:not(.cr-play-btn)')];
		fireEvent.click(buttons[3]);
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:05.0 / 1:40.0');
		fireEvent.click(buttons[1]);
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:04.0 / 1:40.0');
		fireEvent.click(buttons[0]);
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:00.0 / 1:40.0');
	});

	it('flips the play button to a pause while it runs', () => {
		const container = mount();
		const play = container.querySelector<HTMLButtonElement>('.cr-play-btn')!;
		expect(play.querySelector('i')!.className).toBe('fas fa-play');
		fireEvent.click(play);
		expect(play.querySelector('i')!.className).toBe('fas fa-pause');
		fireEvent.click(play);
		expect(play.querySelector('i')!.className).toBe('fas fa-play');
	});

	it('advances the playhead on each animation frame, and stops when paused', () => {
		const container = mount();
		fireEvent.click(container.querySelector<HTMLButtonElement>('.cr-play-btn')!);
		step(1000);
		step(3000);
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:02.0 / 1:40.0');

		fireEvent.click(container.querySelector<HTMLButtonElement>('.cr-play-btn')!);
		step(9000);
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:02.0 / 1:40.0');
	});

	it('marks the chosen speed and plays at it', () => {
		const container = mount();
		const speeds = [...container.querySelectorAll<HTMLButtonElement>('.cr-speed-btn')];
		expect(speeds.map(button => button.className)).toEqual(['cr-speed-btn active', 'cr-speed-btn', 'cr-speed-btn']);
		fireEvent.click(speeds[2]);
		expect(speeds.map(button => button.className)).toEqual(['cr-speed-btn', 'cr-speed-btn', 'cr-speed-btn active']);

		fireEvent.click(container.querySelector<HTMLButtonElement>('.cr-play-btn')!);
		step(1000);
		step(2000);
		expect(container.querySelector('.cr-time-display')!.textContent).toBe('0:03.0 / 1:40.0');
	});

	it('pauses the playback the moment the scrubber is grabbed', () => {
		const container = mount();
		fireEvent.click(container.querySelector<HTMLButtonElement>('.cr-play-btn')!);
		fireEvent.mouseDown(container.querySelector('.cr-scrubber')!);
		expect(container.querySelector('.cr-play-btn i')!.className).toBe('fas fa-play');
	});

	it('rewinds to the start when its tab closes', () => {
		const view = render(<CombatReplay active={true} />);
		seek(view.container, 12);
		expect(view.container.querySelector('.cr-time-display')!.textContent).toBe('0:12.0 / 1:40.0');
		view.rerender(<CombatReplay active={false} />);
		expect(view.container.querySelector('.cr-time-display')!.textContent).toBe('0:00.0 / 1:40.0');
	});

	it('rewinds to the start when a new run arrives', () => {
		const view = render(<CombatReplay active={true} />);
		seek(view.container, 12);
		model = replayModel({ duration: 100, playerName: 'Hero II' });
		result = { result: {}, filter: {} } as SimResultData;
		view.rerender(<CombatReplay active={true} />);
		expect(view.container.querySelector('.cr-cdm-player-label')!.textContent).toBe('Hero II');
		expect(view.container.querySelector('.cr-time-display')!.textContent).toBe('0:00.0 / 1:40.0');
	});
});
